// Realtime type definitions

import type { ObservableUIData } from "../core/ObservableUIData.js";

export type RealtimeOperation = "INSERT" | "UPDATE" | "DELETE";

export interface RealtimeSocket {
  readonly connected?: boolean;
  on(eventType: string, listener: (event: RealtimeEvent) => void): unknown;
  off(eventType: string, listener: (event: RealtimeEvent) => void): unknown;
}

export interface RealtimeEvent<T = unknown> {
  type: string;
  event: RealtimeOperation;
  data?: T;
  browserId?: string;
  [key: string]: unknown;
}

export interface RealtimeConfig<
  TApiData extends { id: string },
  TUiData extends { id: string } = TApiData,
> {
  /** Event type to listen for (e.g., "checkbox_update", "post_update") */
  eventType: string;
  /** Optional: Function to extract data from event. Defaults to (event) => event.data */
  dataExtractor?: (event: RealtimeEvent<TApiData>) => TApiData | undefined;
  /** Optional: Function to determine if event should be processed (runs before dataExtractor) */
  shouldProcessEvent?: (event: RealtimeEvent<TApiData>) => boolean;
  /** Optional: Browser ID to filter out self-originated events (prevents echo) */
  browserId?: string;
  /** Optional handlers keyed by INSERT/UPDATE/DELETE or by the event channel type. */
  customHandlers?: {
    [eventType: string]: (
      store: ObservableUIData<TUiData>,
      event: RealtimeEvent<TApiData>,
    ) => void;
  };
  /** Called when event extraction, filtering, transformation, or handling throws. */
  onError?: (error: unknown, event: RealtimeEvent<TApiData>) => void;
  /** Called after the default INSERT/UPDATE/DELETE handler is applied. */
  onApplied?: (
    operation: RealtimeOperation,
    data: TApiData,
    event: RealtimeEvent<TApiData>,
  ) => void;
}
