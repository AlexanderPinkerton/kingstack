import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Socket, Server } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { Inject, Injectable } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { AppLogger, LogContext } from "@kingstack/logger";
import { APP_LOGGER } from "../logging";

interface RegisterPayload {
  token: string;
  browserId: string;
}

type CheckboxPresenceTone = "lime" | "violet";
type CheckboxPresenceAction = "join" | "focus" | "idle" | "leave";

interface CheckboxPresenceParticipant {
  id: string;
  name: string;
  tone: CheckboxPresenceTone;
}

interface CheckboxPresencePayload {
  action?: CheckboxPresenceAction;
  participant?: CheckboxPresenceParticipant;
  checkboxIndex?: number | null;
}

interface NormalizedCheckboxPresencePayload {
  action: CheckboxPresenceAction;
  participant: CheckboxPresenceParticipant;
  checkboxIndex: number | null;
}

interface CheckboxPresenceState {
  participant: CheckboxPresenceParticipant;
  checkboxIndex: number | null;
}

export function normalizeCheckboxPresencePayload(
  payload: CheckboxPresencePayload | null | undefined,
): NormalizedCheckboxPresencePayload | null {
  const participant = payload?.participant;
  const name =
    typeof participant?.name === "string" ? participant.name.trim() : "";
  const action = payload?.action;
  const checkboxIndex = payload?.checkboxIndex;
  const hasValidFocusIndex =
    typeof checkboxIndex === "number" &&
    Number.isInteger(checkboxIndex) &&
    checkboxIndex >= 0 &&
    checkboxIndex < 200;
  const hasValidIdleIndex = checkboxIndex === null;

  if (
    !participant ||
    typeof participant.id !== "string" ||
    participant.id.length === 0 ||
    participant.id.length > 100 ||
    !name ||
    name.length > 40 ||
    (participant.tone !== "lime" && participant.tone !== "violet") ||
    (action !== "join" &&
      action !== "focus" &&
      action !== "idle" &&
      action !== "leave") ||
    (action === "focus" ? !hasValidFocusIndex : !hasValidIdleIndex)
  ) {
    return null;
  }

  return {
    action,
    participant: {
      id: participant.id,
      name,
      tone: participant.tone,
    },
    checkboxIndex:
      action === "focus" && typeof checkboxIndex === "number"
        ? checkboxIndex
        : null,
  };
}

interface UserSocketMap {
  [browserId: string]: Socket;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger: AppLogger;
  private userSockets: Map<string, UserSocketMap> = new Map();
  private readonly checkboxPresenceBySocket = new Map<
    string,
    CheckboxPresenceState
  >();
  private supabase: SupabaseClient;
  private subscriptionChannel: any = null;
  private readonly supabaseUrl = process.env.SUPABASE_API_URL!;
  private readonly supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  private readonly authSecret = process.env.SUPA_JWT_SECRET!;

  constructor(
    private readonly jwtService: JwtService,
    @Inject(APP_LOGGER) logger: AppLogger,
  ) {
    this.logger = logger.child({ component: RealtimeGateway.name });
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    void this.connectSupabase();
  }

  afterInit(_server: Server) {
    this.logger.info("realtime.gateway_initialized");
  }

  handleConnection(client: Socket) {
    this.socketLogger(client).info("realtime.client_connected");
  }

  handleDisconnect(client: Socket) {
    const presence = this.checkboxPresenceBySocket.get(client.id);
    this.checkboxPresenceBySocket.delete(client.id);
    this.removeSocketFromMap(client);

    if (presence) {
      this.broadcastToAllClients({
        type: "checkbox_presence",
        action: "leave",
        participant: presence.participant,
        checkboxIndex: null,
      });
    }
    this.socketLogger(client).info("realtime.client_disconnected");
  }

  @SubscribeMessage("register")
  handleRegister(
    @MessageBody() data: RegisterPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const decoded = this.jwtService.verify<{ sub: string }>(data.token, {
        secret: this.authSecret,
      });

      const userId = decoded.sub;
      let userSocketMap = this.userSockets.get(userId);
      if (!userSocketMap) {
        userSocketMap = {};
        this.userSockets.set(userId, userSocketMap);
      }
      userSocketMap[data.browserId] = client;
      client.data.userId = userId;
      client.data.browserId = data.browserId;
      this.socketLogger(client).info("realtime.client_registered", {
        browserId: data.browserId,
      });
      return { status: "ok" };
    } catch (err) {
      this.socketLogger(client).error("realtime.jwt_verification_failed", {
        error: err,
      });
      client.disconnect(true);
      return { status: "error", message: "Invalid token" };
    }
  }

  @SubscribeMessage("register_public")
  handleRegisterPublic(
    @MessageBody() data: { browserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.data.browserId = data.browserId;
    this.socketLogger(client).info("realtime.public_client_registered", {
      browserId: data.browserId,
    });
    return { status: "ok" };
  }

  @SubscribeMessage("checkbox_presence")
  handleCheckboxPresence(
    @MessageBody() payload: CheckboxPresencePayload,
    @ConnectedSocket() client: Socket,
  ) {
    if (!client.data.userId) {
      this.socketLogger(client).warn("realtime.presence_unregistered");
      return {
        status: "error",
        message: "Register before publishing presence",
      };
    }

    const presence = normalizeCheckboxPresencePayload(payload);
    if (!presence) {
      this.socketLogger(client).warn("realtime.presence_invalid");
      return { status: "error", message: "Invalid presence payload" };
    }

    const previousPresence = this.checkboxPresenceBySocket.get(client.id);
    if (
      previousPresence &&
      previousPresence.participant.id !== presence.participant.id
    ) {
      this.broadcastToAllClients({
        type: "checkbox_presence",
        action: "leave",
        participant: previousPresence.participant,
        checkboxIndex: null,
      });
    }

    const isNewParticipant =
      !previousPresence ||
      previousPresence.participant.id !== presence.participant.id;

    if (presence.action === "leave") {
      this.checkboxPresenceBySocket.delete(client.id);
    } else {
      if (isNewParticipant) {
        this.sendCheckboxPresenceRoster(client);
      }
      this.checkboxPresenceBySocket.set(client.id, {
        participant: presence.participant,
        checkboxIndex: presence.checkboxIndex,
      });
    }

    this.broadcastToAllClients({
      type: "checkbox_presence",
      action: presence.action,
      participant: presence.participant,
      checkboxIndex: presence.checkboxIndex,
    });
    this.socketLogger(client).debug("realtime.checkbox_presence_broadcast", {
      action: presence.action,
      participantId: presence.participant.id,
      checkboxIndex: presence.checkboxIndex,
    });

    return { status: "ok" };
  }

  private sendCheckboxPresenceRoster(client: Socket): void {
    client.emit("checkbox_presence", {
      type: "checkbox_presence",
      action: "reset",
    });

    this.checkboxPresenceBySocket.forEach((presence, socketId) => {
      if (socketId === client.id) return;

      client.emit("checkbox_presence", {
        type: "checkbox_presence",
        action: presence.checkboxIndex === null ? "join" : "focus",
        participant: presence.participant,
        checkboxIndex: presence.checkboxIndex,
      });
    });
  }

  private removeSocketFromMap(client: Socket) {
    for (const [userId, userSocketMap] of this.userSockets.entries()) {
      for (const [browserId, socket] of Object.entries(userSocketMap)) {
        if (socket.id === client.id) {
          delete userSocketMap[browserId];
          this.socketLogger(client).debug("realtime.socket_removed", {
            userId,
            browserId,
          });
        }
      }
      if (Object.keys(userSocketMap).length === 0) {
        this.userSockets.delete(userId);
        this.logger.debug("realtime.user_sockets_removed", { userId });
      }
    }
  }

  private async connectSupabase() {
    if (this.subscriptionChannel) {
      await this.subscriptionChannel.unsubscribe();
    }

    this.logger.info("realtime.supabase_connecting");

    try {
      // First verify we can access the database
      const { error } = await this.supabase.from("post").select("id").limit(1);

      if (error) {
        this.logger.error("realtime.database_access_failed", { error });
        return;
      }

      this.subscriptionChannel = this.supabase
        .channel("realtime_updates")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "post",
          },
          (payload: any) => this.handlePostRealtime(payload),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "checkbox",
          },
          (payload: any) => this.handleCheckboxRealtime(payload),
        )
        .subscribe((status: any) => {
          this.logger.info("realtime.channel_status_changed", {
            status: String(status),
          });
          if (status === "CHANNEL_ERROR") {
            this.logger.error("realtime.channel_failed");
            setTimeout(() => void this.connectSupabase(), 5000);
          }
        });

      this.subscriptionChannel.on("error", (error: any) => {
        this.logger.error("realtime.subscription_failed", { error });
      });
    } catch (error) {
      this.logger.error("realtime.subscription_setup_failed", { error });
    }
  }

  private handlePostRealtime(payload: any) {
    try {
      const post = payload.new || payload.old;
      const eventType = payload.eventType;

      if (!post) {
        this.logger.warn("realtime.post_payload_missing");
        return;
      }

      this.logger.debug("realtime.post_event_received", {
        eventType: String(eventType),
        postId: String(post.id),
        published: Boolean(post.published),
      });

      // For INSERT and UPDATE events, only broadcast if the post is published
      if (
        (eventType === "INSERT" || eventType === "UPDATE") &&
        post.published === true
      ) {
        this.logger.debug("realtime.post_broadcast_started", {
          postId: String(post.id),
          eventType: String(eventType),
        });

        // Send to all connected clients
        this.broadcastToAllClients({
          type: "post_update",
          event: eventType,
          post: post,
        });
      } else if (eventType === "DELETE") {
        // For DELETE events, always broadcast regardless of published status
        this.logger.debug("realtime.post_broadcast_started", {
          postId: String(post.id),
          eventType: String(eventType),
        });

        this.broadcastToAllClients({
          type: "post_update",
          event: eventType,
          post: post,
        });
      } else {
        this.logger.debug("realtime.post_broadcast_skipped", {
          postId: String(post.id),
          eventType: String(eventType),
        });
      }
    } catch (err) {
      this.logger.error("realtime.post_event_failed", { error: err });
    }
  }

  private handleCheckboxRealtime(payload: any) {
    try {
      const checkbox = payload.new || payload.old;
      const eventType = payload.eventType;

      if (!checkbox) {
        this.logger.warn("realtime.checkbox_payload_missing");
        return;
      }

      this.logger.debug("realtime.checkbox_event_received", {
        eventType: String(eventType),
        checkboxId: String(checkbox.id),
        index: Number(checkbox.index),
        checked: Boolean(checkbox.checked),
      });

      // Broadcast all checkbox events to all clients
      this.broadcastToAllClients({
        type: "checkbox_update",
        event: eventType,
        checkbox: checkbox,
      });

      this.logger.debug("realtime.checkbox_broadcast_completed", {
        checkboxId: String(checkbox.id),
        eventType: String(eventType),
      });
    } catch (err) {
      this.logger.error("realtime.checkbox_event_failed", { error: err });
    }
  }

  private broadcastToAllClients(payload: any) {
    let totalClients = 0;

    for (const [userId, userSocketMap] of this.userSockets.entries()) {
      for (const [browserId, socket] of Object.entries(userSocketMap)) {
        this.logger.trace("realtime.client_emit", { userId, browserId });
        socket.emit(payload.type, payload);
        totalClients++;
      }
    }

    this.logger.info("realtime.broadcast_completed", {
      eventType: String(payload.type),
      clientCount: totalClients,
    });
  }

  private socketLogger(client: Socket): AppLogger {
    const bindings: LogContext = { connectionId: client.id };
    if (typeof client.data.userId === "string") {
      return this.logger.child({
        ...bindings,
        userId: client.data.userId,
      });
    }
    return this.logger.child(bindings);
  }
}
