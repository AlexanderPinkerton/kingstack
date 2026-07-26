// Core type definitions for the optimistic store pattern

import type { QueryKey, QueryObserverResult } from "@tanstack/query-core";
import type { ObservableUIData } from "./ObservableUIData.js";
import type { RealtimeConfig, RealtimeSocket } from "../realtime/types.js";

export interface Entity {
  id: string;
}

// Optimistic state configuration
export interface OptimisticDefaults<
  TUiData extends Entity,
  TCreateInput = any,
  TOptimisticContext = any,
> {
  /** Function to generate optimistic UI data from form input */
  createOptimisticUiData: (
    userInput: TCreateInput,
    context?: TOptimisticContext,
  ) => TUiData;
}

// Transformation interface for API ↔ UI data conversion
export interface DataTransformer<
  TApiData extends Entity,
  TUiData extends Entity,
  TCreateInput = any,
  TOptimisticContext = any,
> {
  toUi(apiData: TApiData): TUiData;
  toApi(uiData: TUiData): TApiData;
  /** Optional: Define optimistic defaults */
  optimisticDefaults?: OptimisticDefaults<
    TUiData,
    TCreateInput,
    TOptimisticContext
  >;
}

export interface OptimisticStoreConfig<
  TApiData extends Entity,
  TUiData extends Entity = TApiData,
  TCreateInput = any,
  TUpdateInput = any,
  TOptimisticContext = any,
> {
  /** Human-readable store name and fallback query key. */
  name: string;
  /**
   * Complete TanStack Query key. Include user, tenant, filters, and other
   * values that change the query result. Defaults to `[name]`.
   */
  queryKey?: QueryKey | (() => QueryKey);
  /** Function to fetch all items - same as TanStack Query queryFn. Can be dynamic to capture current context. */
  queryFn: () => Promise<TApiData[]>;
  /** Mutation functions for CRUD operations. Can be dynamic to capture current context. */
  mutations: {
    create: (data: TCreateInput) => Promise<TApiData>;
    update: (params: { id: string; data: TUpdateInput }) => Promise<TApiData>;
    remove: (id: string) => Promise<{ id: string } | void>;
  };
  /** Transform API data into UI data. Omit or set to false when both shapes are identical. */
  transformer?:
    | DataTransformer<TApiData, TUiData, TCreateInput, TOptimisticContext>
    | false;
  /** Optional: Optimistic defaults configuration (can be provided here or in transformer) */
  optimisticDefaults?: OptimisticDefaults<
    TUiData,
    TCreateInput,
    TOptimisticContext
  >;
  /** Optional: Function to get current context data for optimistic updates (e.g., current user, app state) */
  optimisticContext?: () => TOptimisticContext;
  /** Optional: Custom store class (creates basic ObservableUIData if not provided) */
  storeClass?: new (
    transformer?: DataTransformer<TApiData, TUiData>,
  ) => ObservableUIData<TUiData>;
  /** Optional: Time in milliseconds before query data becomes stale (default: 5 minutes) */
  staleTime?: number;
  /** Optional: Function to determine if query should be enabled (default: () => true) */
  enabled?: () => boolean;
  /** Optional: Realtime configuration - enables realtime updates when provided */
  realtime?: RealtimeConfig<TApiData, TUiData>;
}

export interface OptimisticStore<
  TApiData extends Entity,
  TUiData extends Entity,
  TStore extends ObservableUIData<TUiData> = ObservableUIData<TUiData>,
  TCreateInput = any,
  TUpdateInput = any,
> {
  // UI domain - observable MobX state
  ui: TStore;

  // API domain - TanStack Query + mutations
  api: {
    // Optimistic mutations
    create: (data: TCreateInput) => Promise<TApiData>;
    update: (id: string, data: TUpdateInput) => Promise<TApiData>;
    remove: (id: string) => Promise<void | { id: string }>;

    // Query control
    refetch: () => Promise<QueryObserverResult<TApiData[], Error>>;
    invalidate: () => Promise<void>;
    triggerQuery: () => void;

    // Query state
    status: {
      isLoading: boolean;
      isError: boolean;
      error: Error | null;
      isSyncing: boolean;
      createPending: boolean;
      updatePending: boolean;
      deletePending: boolean;
      hasPendingMutations: boolean;
    };
  };

  // Lifecycle methods
  updateOptions: () => void;
  isEnabled: () => boolean;
  enable: () => void;
  disable: () => void;
  destroy: () => void;

  // Realtime status (only available when realtime config is provided)
  realtime?: {
    isConnected: boolean;
    connect: (socket: RealtimeSocket) => void;
    disconnect: () => void;
  };
}
