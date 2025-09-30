// Main library exports
// Framework-Agnostic MobX + TanStack Query Core Optimistic Store Pattern

// Core
export { ObservableUIData, createOptimisticStore } from "./core";
export type {
  Entity,
  OptimisticDefaults,
  DataTransformer,
  OptimisticStoreConfig,
  OptimisticStore,
} from "./core";

// Transforms
export { createDefaultTransformer, createTransformer } from "./transformer";

// Query
export { getGlobalQueryClient } from "./query";

// Realtime (optional)
export { RealtimeExtension, createRealtimeExtension } from "./realtime";
export type { RealtimeEvent, RealtimeConfig } from "./realtime";
