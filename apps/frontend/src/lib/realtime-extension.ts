// Realtime Extension for Optimistic Store Pattern
// Provides a simple interface for integrating WebSocket realtime updates with optimistic stores
//
// USAGE:
// 1. Create extension: const extension = createRealtimeExtension(store, "checkbox_update");
// 2. Connect: extension.connect(socket);
// 3. Disconnect: extension.disconnect();
//
import { Socket } from "socket.io-client";
import { type OptimisticStore } from "./optimistic-store-pattern";

// ---------- Core Types ----------

export interface RealtimeEvent<T = any> {
  type: string;
  event: "INSERT" | "UPDATE" | "DELETE";
  data?: T;
  [key: string]: any; // Allow for additional properties like 'checkbox', 'post', etc.
}

export interface RealtimeConfig<T extends { id: string }> {
  /** Event type to listen for (e.g., "checkbox_update", "post_update") */
  eventType: string;
  /** Optional: Function to extract data from event. Defaults to (event) => event.data */
  dataExtractor?: (event: RealtimeEvent) => T | undefined;
  /** Optional: Function to determine if event should be processed (runs before dataExtractor) */
  shouldProcessEvent?: (event: RealtimeEvent) => boolean;
  /** Optional: Browser ID to filter out self-originated events (prevents echo) */
  browserId?: string;
  /** Optional: Custom handler for specific event types */
  customHandlers?: {
    [eventType: string]: (
      store: OptimisticStore<T>,
      event: RealtimeEvent,
    ) => void;
  };
}

// ---------- Realtime Extension ----------

export class RealtimeExtension<T extends { id: string }> {
  private store: OptimisticStore<T>;
  private socket: Socket | null = null;
  private config: RealtimeConfig<T>;
  private isConnected = false;

  constructor(store: OptimisticStore<T>, config: RealtimeConfig<T>) {
    this.store = store;
    this.config = config;
  }

  /**
   * Connect to realtime updates via WebSocket
   */
  connect(socket: Socket): void {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = socket;
    this.isConnected = true;

    // Listen for the configured event type
    this.socket.on(this.config.eventType, this.handleRealtimeEvent.bind(this));

    console.log(
      `🔌 RealtimeExtension: Connected to ${this.config.eventType} events`,
    );
  }

  /**
   * Disconnect from realtime updates
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.off(
        this.config.eventType,
        this.handleRealtimeEvent.bind(this),
      );
      this.socket = null;
    }
    this.isConnected = false;
    console.log(
      `🔌 RealtimeExtension: Disconnected from ${this.config.eventType} events`,
    );
  }

  /**
   * Handle incoming realtime events
   */
  private handleRealtimeEvent(event: RealtimeEvent): void {
    console.log(
      `📡 RealtimeExtension: Received ${this.config.eventType} event:`,
      event,
    );

    // 🛡️ PROTECTION 1: Filter out self-originated events (prevent echo)
    if (this.config.browserId && event.browserId === this.config.browserId) {
      console.log(
        `📡 RealtimeExtension: Skipping self-originated event from browser ${event.browserId}`,
      );
      return;
    }

    // 🛡️ PROTECTION 2: Check if we should process this event
    if (
      this.config.shouldProcessEvent &&
      !this.config.shouldProcessEvent(event)
    ) {
      console.log(
        `📡 RealtimeExtension: Skipping event due to shouldProcessEvent filter`,
      );
      return;
    }

    // Use custom handler if available
    if (this.config.customHandlers?.[event.type]) {
      this.config.customHandlers[event.type](this.store, event);
      return;
    }

    // Default handling based on event type
    this.handleDefaultEvent(event);
  }

  /**
   * Default event handling for INSERT, UPDATE, DELETE operations
   */
  private handleDefaultEvent(event: RealtimeEvent): void {
    // Handle the actual event structure: { type, event, data }
    const eventType = event.event;
    
    // 🔧 Use configurable data extractor or default to event.data
    const dataExtractor = this.config.dataExtractor || ((e: RealtimeEvent) => e.data);
    const data = dataExtractor(event);

    try {
      switch (eventType) {
        case "INSERT": // Drop to the UPDATE case
        case "UPDATE":
          if (!data) {
            console.warn(
              `📡 RealtimeExtension: No data found in ${eventType} event:`,
              event,
            );
            return;
          }

          // UI-only update (server already updated via realtime)
          this.store.upsertFromRealtime(data);
          console.log(
            `📡 RealtimeExtension: ${eventType} processed for item ${data.id}`,
          );
          break;

        case "DELETE":
          if (!data) {
            console.warn(
              `📡 RealtimeExtension: No data found in DELETE event:`,
              event,
            );
            return;
          }

          // UI-only removal (server already updated via realtime)
          this.store.removeFromRealtime(data.id);
          console.log(
            `📡 RealtimeExtension: DELETE processed for item ${data.id}`,
          );
          break;

        default:
          console.warn(
            `📡 RealtimeExtension: Unknown event type: ${eventType}`,
          );
      }
    } catch (error) {
      console.error(
        `📡 RealtimeExtension: Error processing ${eventType} event:`,
        error,
      );
    }
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Get the underlying socket
   */
  get socketInstance(): Socket | null {
    return this.socket;
  }
}

// ---------- Helper Functions ----------

/**
 * Create a realtime extension that uses the store's existing DataTransformer
 * This is the main function you'll use to enable realtime for any store
 */
export function createRealtimeExtension<T extends { id: string }>(
  store: OptimisticStore<T>,
  eventType: string,
  options?: {
    dataExtractor?: (event: RealtimeEvent) => T | undefined;
    shouldProcessEvent?: (event: RealtimeEvent) => boolean;
    browserId?: string;
    customHandlers?: {
      [eventType: string]: (
        store: OptimisticStore<T>,
        event: RealtimeEvent,
      ) => void;
    };
  },
): RealtimeExtension<T> {
  return new RealtimeExtension(store, {
    eventType,
    dataExtractor: options?.dataExtractor,
    shouldProcessEvent: options?.shouldProcessEvent || ((event) => event.type === eventType),
    browserId: options?.browserId,
    customHandlers: options?.customHandlers,
  });
}
