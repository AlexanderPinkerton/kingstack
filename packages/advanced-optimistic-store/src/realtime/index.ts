// Realtime module exports

import { RealtimeExtension } from "./RealtimeExtension";
import type { ObservableUIData } from "../core/ObservableUIData";
import type { RealtimeEvent } from "./types";

export { RealtimeExtension } from "./RealtimeExtension";
export type { RealtimeEvent, RealtimeConfig } from "./types";

/**
 * Create a realtime extension that uses the store's existing DataTransformer
 * This is the main function you'll use to enable realtime for any store
 */
export function createRealtimeExtension<T extends { id: string }>(
  store: ObservableUIData<T>,
  eventType: string,
  options?: {
    dataExtractor?: (event: RealtimeEvent) => T | undefined;
    shouldProcessEvent?: (event: RealtimeEvent) => boolean;
    browserId?: string;
    customHandlers?: {
      [eventType: string]: (
        store: ObservableUIData<T>,
        event: RealtimeEvent,
      ) => void;
    };
  },
): RealtimeExtension<T> {
  return new RealtimeExtension(store, {
    eventType,
    dataExtractor: options?.dataExtractor,
    shouldProcessEvent:
      options?.shouldProcessEvent || ((event) => event.type === eventType),
    browserId: options?.browserId,
    customHandlers: options?.customHandlers,
  });
}
