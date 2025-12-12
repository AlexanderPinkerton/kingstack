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
  private stores: RealtimeStore[] = [];
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
    this.stores = stores;
    this.browserId = browserId || getBrowserId();
    this.serverUrl =
      serverUrl || process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
  }

  /**
   * Register stores that support realtime
   */
  registerStores(stores: RealtimeStore[]): void {
    this.stores = [...this.stores, ...stores];
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
      `🔌 RealtimeManager: Connecting ${this.stores.length} stores to realtime`,
    );

    this.stores.forEach((store, index) => {
      try {
        // Try connectRealtime method first (for custom stores)
        if (store.connectRealtime) {
          store.connectRealtime(this.socket!);
          console.log(
            `🔌 RealtimeManager: Connected store ${index} via connectRealtime()`,
          );
        }
        // Fall back to realtime.connect (for optimistic stores)
        else if (store.realtime?.connect) {
          store.realtime.connect(this.socket!);
          console.log(
            `🔌 RealtimeManager: Connected store ${index} via realtime.connect()`,
          );
        }
      } catch (error) {
        console.error(
          `🔌 RealtimeManager: Error connecting store ${index}:`,
          error,
        );
      }
    });
  }

  /**
   * Disconnect all registered stores from realtime
   */
  private disconnectStores(): void {
    console.log(
      `🔌 RealtimeManager: Disconnecting ${this.stores.length} stores from realtime`,
    );

    this.stores.forEach((store, index) => {
      try {
        // Try disconnectRealtime method first (for custom stores)
        if (store.disconnectRealtime) {
          store.disconnectRealtime();
          console.log(
            `🔌 RealtimeManager: Disconnected store ${index} via disconnectRealtime()`,
          );
        }
        // Fall back to realtime.disconnect (for optimistic stores)
        else if (store.realtime?.disconnect) {
          store.realtime.disconnect();
          console.log(
            `🔌 RealtimeManager: Disconnected store ${index} via realtime.disconnect()`,
          );
        }
      } catch (error) {
        console.error(
          `🔌 RealtimeManager: Error disconnecting store ${index}:`,
          error,
        );
      }
    });
  }

  /**
   * Cleanup: teardown connection
   */
  dispose(): void {
    this.teardown();
    this.stores = [];
  }
}
