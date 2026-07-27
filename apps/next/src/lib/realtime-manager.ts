import { io, Socket } from "socket.io-client";
import { getBrowserId } from "./browser-id";

/**
 * Store interface for stores that support realtime connections
 */
export interface RealtimeStore {
  connectRealtime?: (socket: Socket) => void;
  disconnectRealtime?: () => void;
  realtime?: {
    connect?: (socket: Socket) => void;
    disconnect?: () => void;
  };
  [key: string]: any;
}

/**
 * Realtime Manager
 * Handles WebSocket connection lifecycle and connects/disconnects stores
 */
export class RealtimeManager {
  private socket: Socket | null = null;
  private stores = new Set<RealtimeStore>();
  private browserId: string;
  private serverUrl: string;
  private isConnected = false;
  private currentToken: string | null = null;

  constructor(options?: {
    stores?: RealtimeStore[];
    serverUrl?: string;
    browserId?: string;
  }) {
    const { stores = [], serverUrl, browserId } = options || {};
    stores.forEach((store) => this.stores.add(store));
    this.browserId = browserId || getBrowserId();
    this.serverUrl =
      serverUrl ||
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL ||
      "http://localhost:3000";
  }

  /**
   * Register stores that support realtime
   */
  registerStores(stores: RealtimeStore[]): void {
    stores.forEach((store) => {
      const wasRegistered = this.stores.has(store);
      this.stores.add(store);

      if (!wasRegistered && this.connected && this.socket) {
        this.connectStore(store, this.socket);
      }
    });
  }

  unregisterStores(stores: RealtimeStore[]): void {
    stores.forEach((store) => {
      if (!this.stores.delete(store)) return;
      this.disconnectStore(store);
    });
  }

  /**
   * Get current socket connection
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Check if realtime is connected
   */
  get connected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Setup realtime connection with authentication token
   */
  setup(token: string): void {
    // Skip if already connected with the same token
    if (
      this.isConnected &&
      this.socket?.connected &&
      this.currentToken === token
    ) {
      console.log(
        "🔌 RealtimeManager: Already connected with same token, skipping setup",
      );
      return;
    }

    console.log("🔌 RealtimeManager: Setting up realtime connection");

    // Only clean up existing connection if there is one
    if (this.socket || this.isConnected) {
      console.log(
        "🔌 RealtimeManager: Cleaning up existing connection before setup",
      );
      this.teardown();
    }

    // Store the token
    this.currentToken = token;

    // Create new socket connection
    this.socket = this.createSocket();

    // Handle connection
    this.socket.on("connect", () => {
      console.log("🔌 RealtimeManager: Socket connected");
      this.isConnected = true;

      // Register with server (send token and browserId)
      this.socket?.emit("register", {
        token,
        browserId: this.browserId,
      });

      // Connect all registered stores
      this.connectStores();
    });

    // Handle disconnection
    this.socket.on("disconnect", () => {
      console.log("🔌 RealtimeManager: Socket disconnected");
      this.isConnected = false;
      this.disconnectStores();
    });

    // Handle connection errors
    this.socket.on("connect_error", (error) => {
      console.error("🔌 RealtimeManager: Connection error:", error);
      this.isConnected = false;
    });
  }

  /**
   * Teardown realtime connection
   */
  teardown(): void {
    console.log("🔌 RealtimeManager: Tearing down realtime connection");

    // Disconnect all stores first
    this.disconnectStores();

    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
      this.socket = null;
    }

    this.isConnected = false;
    this.currentToken = null;
  }

  /**
   * Create socket connection
   */
  private createSocket(): Socket {
    const socket = io(this.serverUrl, {
      transports: ["websocket"],
      autoConnect: true,
    });

    return socket;
  }

  /**
   * Connect all registered stores to realtime
   */
  private connectStores(): void {
    if (!this.socket) {
      console.warn("🔌 RealtimeManager: Cannot connect stores - no socket");
      return;
    }

    console.log(
      `🔌 RealtimeManager: Connecting ${this.stores.size} stores to realtime`,
    );

    this.stores.forEach((store) => this.connectStore(store, this.socket!));
  }

  /**
   * Disconnect all registered stores from realtime
   */
  private disconnectStores(): void {
    console.log(
      `🔌 RealtimeManager: Disconnecting ${this.stores.size} stores from realtime`,
    );

    this.stores.forEach((store) => this.disconnectStore(store));
  }

  /**
   * Cleanup: teardown connection
   */
  dispose(): void {
    this.teardown();
    this.stores.clear();
  }

  private connectStore(store: RealtimeStore, socket: Socket): void {
    try {
      if (store.connectRealtime) {
        store.connectRealtime(socket);
      } else {
        store.realtime?.connect?.(socket);
      }
    } catch (error) {
      console.error("RealtimeManager: Failed to connect store", error);
    }
  }

  private disconnectStore(store: RealtimeStore): void {
    try {
      if (store.disconnectRealtime) {
        store.disconnectRealtime();
      } else {
        store.realtime?.disconnect?.();
      }
    } catch (error) {
      console.error("RealtimeManager: Failed to disconnect store", error);
    }
  }
}
