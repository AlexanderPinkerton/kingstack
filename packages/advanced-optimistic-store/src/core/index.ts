// Core module exports

// UI data store class (MobX observable)
export { ObservableUIData } from "./ObservableUIData.js";

// Factory function (main API)
export { createOptimisticStore } from "./OptimisticStore.js";

// Types
export type {
  Entity,
  OptimisticDefaults,
  DataTransformer,
  OptimisticStoreConfig,
  OptimisticStore,
} from "./types.js";
