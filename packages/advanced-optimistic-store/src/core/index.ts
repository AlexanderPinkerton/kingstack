// Core module exports

// UI data store class (MobX observable)
export { ObservableUIData } from "./ObservableUIData";

// Factory function (main API)
export { createOptimisticStore } from "./createStoreManager";

// Types
export type {
  Entity,
  OptimisticDefaults,
  DataTransformer,
  OptimisticStoreConfig,
  OptimisticStore,
} from "./types";
