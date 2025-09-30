// Realtime type definitions

import type { OptimisticStore } from "../core/OptimisticStore";

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
