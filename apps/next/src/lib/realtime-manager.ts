import { computed, makeObservable, observable, runInAction } from "mobx";
import { io, type Socket } from "socket.io-client";
import { getBrowserId } from "./browser-id";

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "disposed";

export interface RealtimeSource {
  subscribe<TEvent>(
    eventType: string,
    listener: (event: TEvent) => void,
  ): () => void;
}

interface RealtimeManagerOptions {
  serverUrl?: string;
  browserId?: string;
  socketFactory?: () => Socket;
}

interface Subscription {
  listener: (event: unknown) => void;
}

/**
 * Owns the application Socket.IO connection and channel subscriptions.
 *
 * Domain stores decode transport events into AOS RemoteChange values. The
 * manager deliberately knows nothing about stores, query caches, or MobX UI
 * projections.
 */
export class RealtimeManager implements RealtimeSource {
  status: RealtimeStatus = "idle";
  error: Error | null = null;

  private socket: Socket | null = null;
  private readonly subscriptions = new Map<string, Set<Subscription>>();
  private readonly browserId: string;
  private readonly serverUrl: string;
  private readonly socketFactory: () => Socket;
  private currentToken: string | null = null;
  private disposed = false;

  constructor(options: RealtimeManagerOptions = {}) {
    this.browserId = options.browserId ?? getBrowserId();
    this.serverUrl =
      options.serverUrl ??
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL ??
      "http://localhost:3000";
    this.socketFactory =
      options.socketFactory ??
      (() =>
        io(this.serverUrl, {
          transports: ["websocket"],
          autoConnect: true,
        }));

    makeObservable(this, {
      status: observable,
      error: observable,
      connected: computed,
    });
  }

  get connected(): boolean {
    return this.status === "connected" && this.socket?.connected === true;
  }

  subscribe<TEvent>(
    eventType: string,
    listener: (event: TEvent) => void,
  ): () => void {
    if (this.disposed) {
      throw new Error("Cannot subscribe to a disposed RealtimeManager");
    }

    const subscription: Subscription = {
      listener: listener as (event: unknown) => void,
    };
    const channel =
      this.subscriptions.get(eventType) ?? new Set<Subscription>();
    channel.add(subscription);
    this.subscriptions.set(eventType, channel);
    this.socket?.on(eventType, subscription.listener);

    let released = false;
    return () => {
      if (released) return;
      released = true;

      this.socket?.off(eventType, subscription.listener);
      const currentChannel = this.subscriptions.get(eventType);
      currentChannel?.delete(subscription);
      if (currentChannel?.size === 0) {
        this.subscriptions.delete(eventType);
      }
    };
  }

  setup(token: string): void {
    if (this.disposed) {
      throw new Error("Cannot set up a disposed RealtimeManager");
    }

    if (
      this.currentToken === token &&
      this.socket &&
      (this.status === "connecting" ||
        this.status === "connected" ||
        this.status === "reconnecting")
    ) {
      return;
    }

    this.teardownSocket();
    this.currentToken = token;
    this.setConnectionState("connecting");

    const socket = this.socketFactory();
    this.socket = socket;
    this.attachSubscriptions(socket);

    socket.on("connect", () => {
      if (this.socket !== socket || this.disposed) return;

      this.setConnectionState("connected");
      socket.emit("register", {
        token: this.currentToken,
        browserId: this.browserId,
      });
    });

    socket.on("disconnect", (reason) => {
      if (this.socket !== socket || this.disposed) return;

      if (!this.currentToken) {
        this.setConnectionState("idle");
      } else if (socket.active) {
        this.setConnectionState("reconnecting");
      } else {
        this.setConnectionState(
          "error",
          new Error(`Realtime disconnected: ${reason}`),
        );
      }
    });

    socket.on("connect_error", (error: unknown) => {
      if (this.socket !== socket || this.disposed) return;
      this.setConnectionState("error", this.toError(error));
    });
  }

  teardown(): void {
    if (this.disposed) return;
    this.teardownSocket();
    this.currentToken = null;
    this.setConnectionState("idle");
  }

  dispose(): void {
    if (this.disposed) return;

    this.teardownSocket();
    this.currentToken = null;
    this.subscriptions.clear();
    this.disposed = true;
    this.setConnectionState("disposed");
  }

  private attachSubscriptions(socket: Socket): void {
    this.subscriptions.forEach((subscriptions, eventType) => {
      subscriptions.forEach((subscription) => {
        socket.on(eventType, subscription.listener);
      });
    });
  }

  private detachSubscriptions(socket: Socket): void {
    this.subscriptions.forEach((subscriptions, eventType) => {
      subscriptions.forEach((subscription) => {
        socket.off(eventType, subscription.listener);
      });
    });
  }

  private teardownSocket(): void {
    const socket = this.socket;
    if (!socket) return;

    this.detachSubscriptions(socket);
    socket.removeAllListeners();
    socket.disconnect();
    this.socket = null;
  }

  private setConnectionState(
    status: RealtimeStatus,
    error: Error | null = null,
  ): void {
    runInAction(() => {
      this.status = status;
      this.error = error;
    });
  }

  private toError(error: unknown): Error {
    return error instanceof Error
      ? error
      : new Error("Unknown realtime connection error", { cause: error });
  }
}
