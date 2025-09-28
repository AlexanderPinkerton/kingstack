// Realtime Extension for Optimistic Store Pattern
// Provides a simple interface for integrating WebSocket realtime updates with optimistic stores
//
// USAGE:
// 1. Create extension: const extension = createRealtimeExtension(store, "checkbox_update");
// 2. Connect: extension.connect(socket);
// 3. Disconnect: extension.disconnect();
//
// The extension uses the store's existing DataTransformer for all data transformation.

import { Socket } from "socket.io-client";
import { runInAction } from "mobx";
import { OptimisticStore, DataTransformer } from "./optimistic-store-pattern";

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
  /** Optional: Function to determine if event should be processed */
  shouldProcessEvent?: (event: RealtimeEvent) => boolean;
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
  private transformer?: DataTransformer<any, T>;

  constructor(
    store: OptimisticStore<T>, 
    config: RealtimeConfig<T>,
    transformer?: DataTransformer<any, T>
  ) {
    this.store = store;
    this.config = config;
    this.transformer = transformer;
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

    // Check if we should process this event
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
    // Handle the actual event structure: { type, event, checkbox }
    const eventType = event.event;
    const data = event.checkbox || event.data;

    try {
      runInAction(() => {
        switch (eventType) {
          case "INSERT":
          case "UPDATE":
            if (!data) {
              console.warn(
                `📡 RealtimeExtension: No data found in ${eventType} event:`,
                event,
              );
              return;
            }

            // Use the same transformation pipeline as the store
            const uiData = this.transformer 
              ? this.transformer.toUi(data)
              : (data as T);
            
            this.store.upsert(uiData);
            console.log(
              `📡 RealtimeExtension: ${eventType} processed for item ${uiData.id}`,
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

            // For deletions, we need to find the item by ID and remove it
            const itemToDelete = this.store.list.find(
              (item) => item.id === data.id,
            );
            if (itemToDelete) {
              this.store.removeFromServer(itemToDelete.id);
              console.log(
                `📡 RealtimeExtension: DELETE processed for item ${data.id}`,
              );
            } else {
              console.log(
                `📡 RealtimeExtension: DELETE - item ${data.id} not found in store`,
              );
            }
            break;

          default:
            console.warn(
              `📡 RealtimeExtension: Unknown event type: ${eventType}`,
            );
        }
      });
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
  transformer?: DataTransformer<any, T>,
  options?: {
    shouldProcessEvent?: (event: RealtimeEvent) => boolean;
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
    shouldProcessEvent: options?.shouldProcessEvent || ((event) => event.type === eventType),
    customHandlers: options?.customHandlers,
  }, transformer);
}
