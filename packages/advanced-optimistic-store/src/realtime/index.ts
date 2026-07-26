// Realtime module exports

import { RealtimeExtension } from "./RealtimeExtension.js";
import type { ObservableUIData } from "../core/ObservableUIData.js";
import type { RealtimeConfig } from "./types.js";

export { RealtimeExtension } from "./RealtimeExtension.js";
export type {
  RealtimeConfig,
  RealtimeEvent,
  RealtimeOperation,
  RealtimeSocket,
} from "./types.js";

/**
 * Create a realtime extension that uses the store's existing DataTransformer
 * This is the main function you'll use to enable realtime for any store
 */
export function createRealtimeExtension<
  TApiData extends { id: string },
  TUiData extends { id: string } = TApiData,
>(
  store: ObservableUIData<TUiData>,
  eventType: string,
  options?: Omit<RealtimeConfig<TApiData, TUiData>, "eventType">,
): RealtimeExtension<TApiData, TUiData> {
  return new RealtimeExtension<TApiData, TUiData>(store, {
    eventType,
    dataExtractor: options?.dataExtractor,
    shouldProcessEvent:
      options?.shouldProcessEvent || ((event) => event.type === eventType),
    browserId: options?.browserId,
    customHandlers: options?.customHandlers,
    onError: options?.onError,
    onApplied: options?.onApplied,
  });
}
