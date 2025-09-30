// Main library exports
// Framework-Agnostic MobX + TanStack Query Core Optimistic Store Pattern

// Core
export { OptimisticStore, createOptimisticStoreManager } from "./core";
export type {
  Entity,
  OptimisticDefaults,
  DataTransformer,
  OptimisticStoreConfig,
  OptimisticStoreManager,
} from "./core";

// Transforms
export { createDefaultTransformer, createTransformer } from "./transforms";

// Query
export { getGlobalQueryClient } from "./query";

// Realtime (optional)
export { RealtimeExtension, createRealtimeExtension } from "./realtime";
export type { RealtimeEvent, RealtimeConfig } from "./realtime";
