// Realtime Extension for Optimistic Store Pattern
// Provides a clean, generic interface for integrating WebSocket realtime updates with optimistic stores
//
// USAGE EXAMPLES:
//
// 1. Simple realtime extension (minimal config):
//    const extension = createSimpleRealtimeExtension(store, "user_update");
//
// 2. Smart realtime extension (automatic data transformation):
//    const extension = createSmartRealtimeExtension(store, "post_update", {
//      dateFields: ["created_at", "updated_at"],
//      booleanFields: ["published", "featured"],
//      numberFields: ["views", "likes"],
//    });
//
// 3. Custom realtime extension (full control):
//    const extension = createRealtimeExtension(store, {
//      eventType: "custom_event",
//      transformRealtimeData: (data) => ({ ...data, processed: true }),
//      shouldProcessEvent: (event) => event.type === "custom_event",
//    });
//
// 4. Connect to socket:
//    extension.connect(socket);
//
// 5. Disconnect:
//    extension.disconnect();

import { Socket } from "socket.io-client";
import { runInAction } from "mobx";
import { OptimisticStore } from "./optimistic-store-pattern";

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
  /** Function to transform realtime data to UI data */
  transformRealtimeData: (realtimeData: any) => T;
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

            const uiData = this.config.transformRealtimeData(data);
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
 * Create a realtime extension with automatic data transformation
 * This is the main function you'll use to enable realtime for any store
 */
export function createRealtimeExtension<T extends { id: string }>(
  store: OptimisticStore<T>,
  config: RealtimeConfig<T>,
): RealtimeExtension<T> {
  return new RealtimeExtension(store, config);
}

/**
 * Create a realtime extension with smart data transformation
 * Automatically handles common data patterns like dates, booleans, etc.
 */
export function createSmartRealtimeExtension<T extends { id: string }>(
  store: OptimisticStore<T>,
  eventType: string,
  options?: {
    /** Custom data transformation function */
    transformData?: (data: any) => T;
    /** Field names that should be converted to Date objects */
    dateFields?: (keyof T)[];
    /** Field names that should be converted to boolean */
    booleanFields?: (keyof T)[];
    /** Field names that should be converted to numbers */
    numberFields?: (keyof T)[];
    /** Custom event filter function */
    shouldProcessEvent?: (event: RealtimeEvent) => boolean;
  },
): RealtimeExtension<T> {
  const {
    transformData,
    dateFields = [],
    booleanFields = [],
    numberFields = [],
    shouldProcessEvent,
  } = options || {};

  return new RealtimeExtension(store, {
    eventType,
    transformRealtimeData: transformData || ((data: any) => {
      // Smart transformation with common patterns
      const transformed = { ...data };
      
      // Convert date fields
      dateFields.forEach(field => {
        if (data[field] && typeof data[field] === 'string') {
          const date = new Date(data[field]);
          if (!isNaN(date.getTime())) {
            transformed[field] = date as any;
          }
        }
      });
      
      // Convert boolean fields
      booleanFields.forEach(field => {
        if (data[field] !== undefined) {
          if (typeof data[field] === 'string') {
            transformed[field] = (data[field] === 'true' || data[field] === '1') as any;
          } else {
            transformed[field] = Boolean(data[field]) as any;
          }
        }
      });
      
      // Convert number fields
      numberFields.forEach(field => {
        if (data[field] !== undefined && !isNaN(Number(data[field]))) {
          transformed[field] = Number(data[field]) as any;
        }
      });
      
      return transformed as T;
    }),
    shouldProcessEvent: shouldProcessEvent || ((event) => event.type === eventType),
  });
}

/**
 * Create a realtime extension with minimal configuration
 * Just provide the event type and store - everything else is automatic
 */
export function createSimpleRealtimeExtension<T extends { id: string }>(
  store: OptimisticStore<T>,
  eventType: string,
): RealtimeExtension<T> {
  return new RealtimeExtension(store, {
    eventType,
    transformRealtimeData: (data: any) => data as T,
    shouldProcessEvent: (event) => event.type === eventType,
  });
}
