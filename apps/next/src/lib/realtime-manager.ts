import { computed, makeObservable, observable, runInAction } from "mobx";
import { io, type Socket } from "socket.io-client";
import { getBrowserId } from "./browser-id";

export type RealtimeStatus =
  "idle" | "connecting" | "connected" | "reconnecting" | "error" | "disposed";

export interface RealtimeSource {
  subscribe<TEvent>(
    eventType: string,
    listener: (event: TEvent) => void,
  ): () => void;
}

export interface PublishOptions {
  /**
   * Marks the message as the caller's current state for this key. The latest
   * value per key is re-sent after a reconnect so a dropped socket does not
   * leave the caller invisible to peers.
   */
  latestKey?: string;
  /**
   * Coalesce to a trailing edge at most once per interval. Required for pointer
   * streams; without it a mousemove handler emits a frame per pixel.
   */
  throttleMs?: number;
}

export interface RealtimeTransport extends RealtimeSource {
  publish<TEvent>(
    eventType: string,
    event: TEvent,
    options?: PublishOptions,
  ): void;
  /** Forgets a `latestKey` so it is no longer replayed after a reconnect. */
  dropLatest(latestKey: string): void;
  /** Ref-counted. Rooms are re-joined automatically after a reconnect. */
  joinRoom(roomId: string): () => void;
}

interface RealtimeManagerOptions {
  serverUrl?: string;
  browserId?: string;
  socketFactory?: () => Socket;
  now?: () => number;
  scheduleFlush?: (callback: () => void, delayMs: number) => unknown;
  cancelFlush?: (handle: unknown) => void;
}

interface Subscription {
  listener: (event: unknown) => void;
}

interface PendingPublication {
  eventType: string;
  event: unknown;
}

interface ThrottleState {
  lastSentMs: number;
  handle: unknown | null;
  pending: PendingPublication | null;
}

/**
 * Owns the application Socket.IO connection and channel subscriptions.
 *
 * Domain stores decode transport events into AOS RemoteChange values. The
 * manager deliberately knows nothing about stores, query caches, or MobX UI
 * projections.
 */
export class RealtimeManager implements RealtimeTransport {
  status: RealtimeStatus = "idle";
  error: Error | null = null;

  private socket: Socket | null = null;
  private readonly subscriptions = new Map<string, Set<Subscription>>();
  private readonly latestPublications = new Map<string, PendingPublication>();
  private readonly throttles = new Map<string, ThrottleState>();
  private readonly roomCounts = new Map<string, number>();
  private readonly browserId: string;
  private readonly serverUrl: string;
  private readonly socketFactory: () => Socket;
  private readonly now: () => number;
  private readonly scheduleFlush: (
    callback: () => void,
    delayMs: number,
  ) => unknown;
  private readonly cancelFlush: (handle: unknown) => void;
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
    this.now = options.now ?? (() => Date.now());
    this.scheduleFlush =
      options.scheduleFlush ??
      ((callback, delayMs) => setTimeout(callback, delayMs));
    this.cancelFlush =
      options.cancelFlush ??
      ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

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

  publish<TEvent>(
    eventType: string,
    event: TEvent,
    options: PublishOptions = {},
  ): void {
    if (this.disposed) {
      throw new Error("Cannot publish with a disposed RealtimeManager");
    }

    const { latestKey, throttleMs } = options;
    if (latestKey) {
      this.latestPublications.set(latestKey, { eventType, event });
    }

    if (!throttleMs || throttleMs <= 0) {
      this.emit(eventType, event);
      return;
    }

    const throttleKey = latestKey ?? eventType;
    const state = this.throttles.get(throttleKey) ?? {
      lastSentMs: Number.NEGATIVE_INFINITY,
      handle: null,
      pending: null,
    };
    this.throttles.set(throttleKey, state);

    const elapsed = this.now() - state.lastSentMs;
    if (elapsed >= throttleMs && state.handle === null) {
      state.lastSentMs = this.now();
      this.emit(eventType, event);
      return;
    }

    // Inside the window: keep only the newest frame and flush it on the
    // trailing edge, so a fast pointer collapses to one message per interval.
    state.pending = { eventType, event };
    if (state.handle !== null) return;

    state.handle = this.scheduleFlush(
      () => {
        state.handle = null;
        const pending = state.pending;
        state.pending = null;
        if (!pending || this.disposed) return;
        state.lastSentMs = this.now();
        this.emit(pending.eventType, pending.event);
      },
      Math.max(0, throttleMs - elapsed),
    );
  }

  dropLatest(latestKey: string): void {
    this.latestPublications.delete(latestKey);

    const throttle = this.throttles.get(latestKey);
    if (throttle?.handle != null) this.cancelFlush(throttle.handle);
    this.throttles.delete(latestKey);
  }

  /**
   * Joins a server room. Multiple callers may hold the same room; the socket
   * only leaves once the final holder releases it.
   */
  joinRoom(roomId: string): () => void {
    if (this.disposed) {
      throw new Error("Cannot join a room with a disposed RealtimeManager");
    }

    const nextCount = (this.roomCounts.get(roomId) ?? 0) + 1;
    this.roomCounts.set(roomId, nextCount);
    if (nextCount === 1) {
      this.emit("room:join", { roomId });
    }

    let released = false;
    return () => {
      if (released || this.disposed) return;
      released = true;

      const remaining = (this.roomCounts.get(roomId) ?? 1) - 1;
      if (remaining > 0) {
        this.roomCounts.set(roomId, remaining);
        return;
      }

      this.roomCounts.delete(roomId);
      this.emit("room:leave", { roomId });
    };
  }

  private emit(eventType: string, event: unknown): void {
    if (this.socket?.connected && this.status === "connected") {
      this.socket.emit(eventType, event);
    }
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
      this.restoreSessionState(socket);
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
    this.clearThrottles();
    this.latestPublications.clear();
    this.currentToken = null;
    this.setConnectionState("idle");
    // Room holders are left intact: they still own their subscription, so a
    // later setup() re-joins on their behalf.
  }

  dispose(): void {
    if (this.disposed) return;

    this.teardownSocket();
    this.clearThrottles();
    this.currentToken = null;
    this.subscriptions.clear();
    this.latestPublications.clear();
    this.roomCounts.clear();
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

  /**
   * Restores this client's server-side footprint after a reconnect: rooms
   * first, because the server rejects presence from a socket that is not yet a
   * member of the room it names.
   */
  private restoreSessionState(socket: Socket): void {
    this.roomCounts.forEach((_count, roomId) => {
      socket.emit("room:join", { roomId });
    });
    this.latestPublications.forEach((publication) => {
      socket.emit(publication.eventType, publication.event);
    });
  }

  private clearThrottles(): void {
    this.throttles.forEach((state) => {
      if (state.handle !== null) this.cancelFlush(state.handle);
    });
    this.throttles.clear();
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
