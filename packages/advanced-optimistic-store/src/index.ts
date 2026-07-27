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
  RemoteApplyResult,
  RemoteChange,
  RemoteChangeContext,
  RemoteConfig,
  RemoteMembership,
  RemoteOperation,
} from "./core/index.js";

// Transforms
export {
  createDefaultTransformer,
  createTransformer,
} from "./transformer/index.js";

// Query
export { getGlobalQueryClient } from "./query/index.js";
