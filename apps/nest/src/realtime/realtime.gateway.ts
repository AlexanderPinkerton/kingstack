import {
  WebSocketGateway,
  WebSocketServer,
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
import {
  normalizeParticipant,
  normalizeRoomId,
  roomNamespaceOf,
  type PresenceEntry,
  type PresenceSetPayload,
  type RoomPayload,
} from "./presence/presence-protocol";
import { getRoomNamespaceConfig } from "./presence/room-namespaces";
import { RoomRegistry } from "./presence/room-registry";
import { TokenBucketLimiter } from "./presence/rate-limiter";

interface RegisterPayload {
  token: string;
  browserId: string;
}

/** Rooms that carry database-backed entity events. */
export const CHECKBOX_ROOM_ID = "checkboxes:global";
export const POST_ROOM_ID = "posts:global";

/**
 * Generous enough for a pointer stream throttled to ~30Hz on the client, tight
 * enough that a misbehaving client cannot saturate the room.
 */
const PRESENCE_RATE_PER_SECOND = 60;
const PRESENCE_BURST = 120;

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger: AppLogger;
  private readonly rooms = new RoomRegistry();
  private readonly presenceLimiter = new TokenBucketLimiter({
    ratePerSecond: PRESENCE_RATE_PER_SECOND,
    burst: PRESENCE_BURST,
  });
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

  afterInit(server: Server) {
    this.server = server;
    this.logger.info("realtime.gateway_initialized");
  }

  handleConnection(client: Socket) {
    this.socketLogger(client).info("realtime.client_connected");
  }

  handleDisconnect(client: Socket) {
    const retractions = this.rooms.leaveAll(client.id);
    this.presenceLimiter.release(client.id);

    for (const retraction of retractions) {
      this.emitToRoom(retraction.roomId, {
        type: "presence",
        roomId: retraction.roomId,
        action: "remove",
        participantId: retraction.participantId,
      });
    }

    this.socketLogger(client).info("realtime.client_disconnected", {
      retractedRooms: retractions.length,
    });
  }

  // ---------- Registration ----------

  @SubscribeMessage("register")
  handleRegister(
    @MessageBody() data: RegisterPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const decoded = this.jwtService.verify<{ sub: string }>(data.token, {
        secret: this.authSecret,
      });

      client.data.userId = decoded.sub;
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

  // ---------- Rooms ----------

  @SubscribeMessage("room:join")
  async handleRoomJoin(
    @MessageBody() payload: RoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = normalizeRoomId(payload?.roomId);
    if (!roomId) {
      this.socketLogger(client).warn("realtime.room_id_invalid");
      return { status: "error", message: "Invalid room id" };
    }

    const denial = this.denyRoomAccess(client, roomId);
    if (denial) {
      this.socketLogger(client).warn("realtime.room_join_denied", {
        roomId,
        reason: denial,
      });
      return { status: "error", message: denial };
    }

    // Registry membership is recorded synchronously so a `presence:set` that
    // arrives immediately behind this join is not rejected as a non-member.
    this.rooms.join(client.id, roomId);
    await client.join(roomId);

    // Replay current occupants so a late joiner starts with a full roster.
    client.emit("presence", {
      type: "presence",
      roomId,
      action: "sync",
      entries: this.rooms.snapshot(roomId, client.id),
    });

    this.socketLogger(client).debug("realtime.room_joined", {
      roomId,
      memberCount: this.rooms.memberCount(roomId),
    });
    return { status: "ok" };
  }

  @SubscribeMessage("room:leave")
  async handleRoomLeave(
    @MessageBody() payload: RoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = normalizeRoomId(payload?.roomId);
    if (!roomId) return { status: "error", message: "Invalid room id" };

    const retraction = this.rooms.leave(client.id, roomId);
    await client.leave(roomId);

    if (retraction) {
      this.emitToRoom(roomId, {
        type: "presence",
        roomId,
        action: "remove",
        participantId: retraction.participantId,
      });
    }

    this.socketLogger(client).debug("realtime.room_left", { roomId });
    return { status: "ok" };
  }

  // ---------- Presence ----------

  @SubscribeMessage("presence:set")
  handlePresenceSet(
    @MessageBody() payload: PresenceSetPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = normalizeRoomId(payload?.roomId);
    if (!roomId || !this.rooms.isMember(client.id, roomId)) {
      this.socketLogger(client).warn("realtime.presence_room_not_joined", {
        roomId: String(payload?.roomId),
      });
      return { status: "error", message: "Join the room before publishing" };
    }

    if (!this.presenceLimiter.allow(client.id)) {
      this.socketLogger(client).debug("realtime.presence_rate_limited", {
        roomId,
      });
      return { status: "error", message: "Rate limited" };
    }

    const participant = normalizeParticipant(payload?.participant);
    if (!participant) {
      this.socketLogger(client).warn("realtime.presence_participant_invalid", {
        roomId,
      });
      return { status: "error", message: "Invalid participant" };
    }

    const config = getRoomNamespaceConfig(roomNamespaceOf(roomId));
    if (!config) return { status: "error", message: "Unknown room namespace" };

    const rawState = payload?.state ?? null;
    const state = rawState === null ? null : config.validateState(rawState);
    if (state === null && rawState !== null) {
      this.socketLogger(client).warn("realtime.presence_state_invalid", {
        roomId,
      });
      return { status: "error", message: "Invalid presence state" };
    }

    const entry: PresenceEntry = { participant, state: state ?? null };
    const result = this.rooms.setPresence(client.id, roomId, entry);
    if (!result) return { status: "error", message: "Not a room member" };

    // A socket that swapped identity leaves a ghost behind; retract it first.
    if (result.supersededParticipantId) {
      this.emitToRoom(roomId, {
        type: "presence",
        roomId,
        action: "remove",
        participantId: result.supersededParticipantId,
      });
    }

    // The sender already applied this locally; only peers need the echo.
    client.to(roomId).emit("presence", {
      type: "presence",
      roomId,
      action: "upsert",
      entry,
    });

    return { status: "ok" };
  }

  @SubscribeMessage("presence:clear")
  handlePresenceClear(
    @MessageBody() payload: RoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = normalizeRoomId(payload?.roomId);
    if (!roomId) return { status: "error", message: "Invalid room id" };

    const participantId = this.rooms.clearPresence(client.id, roomId);
    if (!participantId) return { status: "ok" };

    client.to(roomId).emit("presence", {
      type: "presence",
      roomId,
      action: "remove",
      participantId,
    });

    return { status: "ok" };
  }

  private denyRoomAccess(client: Socket, roomId: string): string | null {
    const config = getRoomNamespaceConfig(roomNamespaceOf(roomId));
    if (!config) return "Unknown room namespace";
    if (typeof client.data.browserId !== "string") {
      return "Register before joining a room";
    }
    if (config.requiresAuth && typeof client.data.userId !== "string") {
      return "Room requires an authenticated connection";
    }
    return null;
  }

  // ---------- Supabase entity events ----------

  private async connectSupabase() {
    if (this.subscriptionChannel) {
      await this.subscriptionChannel.unsubscribe();
    }

    this.logger.info("realtime.supabase_connecting", { url: this.supabaseUrl });

    try {
      // First verify we can access the database
      const { error } = await this.supabase.from("post").select("id").limit(1);

      if (error) {
        // The url is the usual culprit: a local stack whose containers are
        // bound to different ports than the current config declares.
        this.logger.error("realtime.database_access_failed", {
          error,
          context: { url: this.supabaseUrl },
        });
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

      // Inserts and updates only reach the room once the post is published;
      // deletes always propagate so stale rows cannot linger in a client cache.
      const shouldBroadcast =
        eventType === "DELETE" ||
        ((eventType === "INSERT" || eventType === "UPDATE") &&
          post.published === true);

      if (!shouldBroadcast) {
        this.logger.debug("realtime.post_broadcast_skipped", {
          postId: String(post.id),
          eventType: String(eventType),
        });
        return;
      }

      this.emitToRoom(POST_ROOM_ID, {
        type: "post_update",
        event: eventType,
        post,
      });
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

      this.emitToRoom(CHECKBOX_ROOM_ID, {
        type: "checkbox_update",
        event: eventType,
        checkbox,
      });
    } catch (err) {
      this.logger.error("realtime.checkbox_event_failed", { error: err });
    }
  }

  private emitToRoom(
    roomId: string,
    payload: { type: string } & Record<string, unknown>,
  ): void {
    if (!this.server) {
      this.logger.warn("realtime.server_unavailable", { roomId });
      return;
    }

    this.server.to(roomId).emit(payload.type, payload);
    this.logger.debug("realtime.room_broadcast", {
      roomId,
      eventType: payload.type,
      memberCount: this.rooms.memberCount(roomId),
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
