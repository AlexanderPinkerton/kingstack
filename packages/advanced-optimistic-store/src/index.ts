// Main library exports
// Framework-Agnostic MobX + TanStack Query Core Optimistic Store Pattern

// Core
export { ObservableUIData, createOptimisticStore } from "./core/index.js";
export type {
  Entity,
  OptimisticDefaults,
  DataTransformer,
  OptimisticStoreConfig,
  OptimisticStore,
} from "./core/index.js";

// Transforms
export {
  createDefaultTransformer,
  createTransformer,
} from "./transformer/index.js";

// Query
export { getGlobalQueryClient } from "./query/index.js";

// Realtime (optional)
export {
  RealtimeExtension,
  createRealtimeExtension,
} from "./realtime/index.js";
export type {
  RealtimeConfig,
  RealtimeEvent,
  RealtimeOperation,
  RealtimeSocket,
} from "./realtime/index.js";
