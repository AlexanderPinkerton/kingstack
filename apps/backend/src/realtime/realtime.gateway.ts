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
import { Injectable, Logger } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface RegisterPayload {
  token: string;
  browserId: string;
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
  private logger = new Logger("RealtimeGateway");
  private userSockets: Map<string, UserSocketMap> = new Map();
  private supabase: SupabaseClient;
  private subscriptionChannel: any = null;
  private readonly supabaseUrl = process.env.SUPABASE_URL!;
  private readonly supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  private readonly authSecret = process.env.SUPA_JWT_SECRET!;

  constructor(private jwtService: JwtService) {
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    this.connectSupabase();
  }

  afterInit(server: Server) {
    this.logger.log("WebSocket Gateway Initialized");
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.removeSocketFromMap(client);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("register")
  async handleRegister(
    @MessageBody() data: RegisterPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const decoded: any = this.jwtService.verify(data.token, {
        secret: this.authSecret,
      });

      const userId = decoded.sub;
      let userSocketMap = this.userSockets.get(userId);
      if (!userSocketMap) {
        userSocketMap = {};
        this.userSockets.set(userId, userSocketMap);
      }
      userSocketMap[data.browserId] = client;
      this.logger.log(
        `Registered socket for user ${userId} and browser ${data.browserId}`,
      );
      client.data.userId = userId;
      client.data.browserId = data.browserId;
      return { status: "ok" };
    } catch (err) {
      this.logger.error("JWT verification failed", err);
      client.disconnect(true);
      return { status: "error", message: "Invalid token" };
    }
  }

  private removeSocketFromMap(client: Socket) {
    for (const [userId, userSocketMap] of this.userSockets.entries()) {
      for (const [browserId, socket] of Object.entries(userSocketMap)) {
        if (socket.id === client.id) {
          delete userSocketMap[browserId];
          this.logger.log(
            `Removed socket for user ${userId} and browser ${browserId}`,
          );
        }
      }
      if (Object.keys(userSocketMap).length === 0) {
        this.userSockets.delete(userId);
        this.logger.log(`Removed all sockets for user ${userId}`);
      }
    }
  }

  private async connectSupabase() {
    if (this.subscriptionChannel) {
      await this.subscriptionChannel.unsubscribe();
    }

    this.logger.log(
      `Attempting to connect to Supabase with URL: ${this.supabaseUrl}`,
    );

    try {
      // First verify we can access the database
      const { data, error } = await this.supabase
        .from("post")
        .select("id")
        .limit(1);

      if (error) {
        this.logger.error("Error accessing database:", error);
        return;
      }

      this.subscriptionChannel = this.supabase
        .channel("posts")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "post",
          },
          (payload: any) => this.handlePostRealtime(payload),
        )
        .subscribe((status: any) => {
          this.logger.log(`Supabase channel status: ${status}`);
          if (status === "CHANNEL_ERROR") {
            this.logger.error(
              "Channel error occurred. Attempting to reconnect...",
            );
            setTimeout(() => this.connectSupabase(), 5000);
          }
        });

      this.subscriptionChannel.on("error", (error: any) => {
        this.logger.error("Supabase subscription error details:", error);
      });
    } catch (error) {
      this.logger.error("Error setting up Supabase subscription:", error);
    }
  }

  private async handlePostRealtime(payload: any) {
    try {
      const post = payload.new || payload.old;
      const eventType = payload.eventType;

      if (!post) {
        this.logger.log("No post data in payload");
        return;
      }

      this.logger.log(`Post realtime event: ${eventType} - ${post.id} - ${post.title} - published: ${post.published}`);

      // For INSERT and UPDATE events, only broadcast if the post is published
      if ((eventType === "INSERT" || eventType === "UPDATE") && post.published === true) {
        this.logger.log(`Broadcasting post update: ${post.id} - ${post.title}`);

        // Send to all connected clients
        this.broadcastToAllClients({
          type: "post_update",
          event: eventType,
          post: post,
        });
      } else if (eventType === "DELETE") {
        // For DELETE events, always broadcast regardless of published status
        this.logger.log(`Broadcasting post deletion: ${post.id}`);

        this.broadcastToAllClients({
          type: "post_update",
          event: eventType,
          post: post,
        });
      } else {
        this.logger.log(`Post ${post.id} is not published or event is not relevant, skipping broadcast`);
      }
    } catch (err) {
      this.logger.error("Error handling post realtime update:", err);
    }
  }

  private broadcastToAllClients(payload: any) {
    let totalClients = 0;

    for (const [userId, userSocketMap] of this.userSockets.entries()) {
      for (const [browserId, socket] of Object.entries(userSocketMap)) {
        this.logger.log(
          `Sending post update to user ${userId}, browser ${browserId}`,
        );
        socket.emit("post_update", payload);
        totalClients++;
      }
    }

    this.logger.log(`Broadcasted post update to ${totalClients} clients`);
  }
}
