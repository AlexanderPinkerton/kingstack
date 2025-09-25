// Realtime Extension for Optimistic Store Pattern
// Provides a clean interface for integrating WebSocket realtime updates with optimistic stores

import { Socket } from "socket.io-client";
import { runInAction } from "mobx";
import { OptimisticStore } from "./optimistic-store-pattern";

// ---------- Core Types ----------

export interface RealtimeEvent<T = any> {
  type: string;
  event: "INSERT" | "UPDATE" | "DELETE";
  data: T;
}

export interface RealtimeConfig<T extends { id: string }> {
  /** Event type to listen for (e.g., "checkbox_update", "post_update") */
  eventType: string;
  /** Function to transform realtime data to UI data */
  transformRealtimeData: (realtimeData: any) => T;
  /** Optional: Function to determine if event should be processed */
  shouldProcessEvent?: (event: RealtimeEvent) => boolean;
  /** Optional: Custom handler for specific event types */
  customHandlers?: {
    [eventType: string]: (store: OptimisticStore<T>, event: RealtimeEvent) => void;
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

    console.log(`🔌 RealtimeExtension: Connected to ${this.config.eventType} events`);
  }

  /**
   * Disconnect from realtime updates
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.off(this.config.eventType, this.handleRealtimeEvent.bind(this));
      this.socket = null;
    }
    this.isConnected = false;
    console.log(`🔌 RealtimeExtension: Disconnected from ${this.config.eventType} events`);
  }

  /**
   * Handle incoming realtime events
   */
  private handleRealtimeEvent(event: RealtimeEvent): void {
    console.log(`📡 RealtimeExtension: Received ${this.config.eventType} event:`, event);

    // Check if we should process this event
    if (this.config.shouldProcessEvent && !this.config.shouldProcessEvent(event)) {
      console.log(`📡 RealtimeExtension: Skipping event due to shouldProcessEvent filter`);
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
    const { event: eventType, data } = event;

    try {
      runInAction(() => {
        switch (eventType) {
          case "INSERT":
          case "UPDATE":
            // Handle different data structures - check if data is nested
            const actualData = data?.checkbox || data;
            if (!actualData) {
              console.warn(`📡 RealtimeExtension: No data found in ${eventType} event:`, event);
              return;
            }
            
            const uiData = this.config.transformRealtimeData(actualData);
            this.store.upsert(uiData);
            console.log(`📡 RealtimeExtension: ${eventType} processed for item ${uiData.id}`);
            break;

          case "DELETE":
            // Handle different data structures for delete
            const deleteData = data?.checkbox || data;
            if (!deleteData) {
              console.warn(`📡 RealtimeExtension: No data found in DELETE event:`, event);
              return;
            }
            
            // For deletions, we need to find the item by ID and remove it
            const itemToDelete = this.store.list.find(item => item.id === deleteData.id);
            if (itemToDelete) {
              this.store.removeFromServer(itemToDelete.id);
              console.log(`📡 RealtimeExtension: DELETE processed for item ${deleteData.id}`);
            } else {
              console.log(`📡 RealtimeExtension: DELETE - item ${deleteData.id} not found in store`);
            }
            break;

          default:
            console.warn(`📡 RealtimeExtension: Unknown event type: ${eventType}`);
        }
      });
    } catch (error) {
      console.error(`📡 RealtimeExtension: Error processing ${eventType} event:`, error);
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
 * Create a realtime extension with common checkbox configuration
 */
export function createCheckboxRealtimeExtension<T extends { id: string; index: number; checked: boolean }>(
  store: OptimisticStore<T>
): RealtimeExtension<T> {
  return new RealtimeExtension(store, {
    eventType: "checkbox_update",
    transformRealtimeData: (data: any) => ({
      id: data.id,
      index: data.index,
      checked: data.checked,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    } as unknown as T),
    shouldProcessEvent: (event) => {
      // Only process checkbox events
      return event.type === "checkbox_update";
    },
  });
}

/**
 * Create a realtime extension with common post configuration
 */
export function createPostRealtimeExtension<T extends { id: string; title: string; published: boolean }>(
  store: OptimisticStore<T>
): RealtimeExtension<T> {
  return new RealtimeExtension(store, {
    eventType: "post_update",
    transformRealtimeData: (data: any) => ({
      id: data.id,
      title: data.title,
      published: data.published,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    } as unknown as T),
    shouldProcessEvent: (event) => {
      // Only process post events
      return event.type === "post_update";
    },
  });
}

/**
 * Create a generic realtime extension
 */
export function createRealtimeExtension<T extends { id: string }>(
  store: OptimisticStore<T>,
  config: RealtimeConfig<T>
): RealtimeExtension<T> {
  return new RealtimeExtension(store, config);
}
