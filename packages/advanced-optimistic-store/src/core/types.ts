// Core type definitions for the optimistic store pattern

import type { QueryKey, QueryObserverResult } from "@tanstack/query-core";
import type { ObservableUIData } from "./ObservableUIData.js";

export interface Entity {
  id: string;
}

export type RemoteOperation = "insert" | "update" | "delete";

/**
 * Whether an upsert belongs in the collection represented by its query key.
 *
 * `unknown` is the safe default for filtered collections: existing entities
 * are updated, missing entities are not appended, and the query is invalidated.
 */
export type RemoteMembership = "include" | "exclude" | "unknown";

interface RemoteChangeMetadata {
  /** Cache scope affected by the change. Defaults to the current query key. */
  queryKey?: QueryKey;
  /** Optional source identifier for application-defined echo filtering. */
  originId?: string;
  /** Optional application revision metadata. */
  revision?: string | number;
}

export type RemoteChange<TApiData extends Entity> =
  | (RemoteChangeMetadata & {
      operation: "insert" | "update";
      entity: TApiData;
      membership?: RemoteMembership;
    })
  | (RemoteChangeMetadata & {
      operation: "delete";
      id: string;
    });

export interface RemoteChangeContext<
  TApiData extends Entity,
  TUiData extends Entity,
> {
  currentQueryKey: QueryKey;
  targetQueryKey: QueryKey;
  cachedEntity?: TApiData;
  visibleEntity?: TUiData;
}

export interface RemoteConfig<TApiData extends Entity, TUiData extends Entity> {
  /** Optional local origin ID. Matching remote changes are ignored. */
  localOriginId?: string | (() => string | undefined);
  /**
   * Optional domain conflict policy. Return false to ignore the entire change.
   * Revision comparison and other domain ordering rules belong here.
   */
  shouldApply?: (
    change: RemoteChange<TApiData>,
    context: RemoteChangeContext<TApiData, TUiData>,
  ) => boolean;
}

export type RemoteApplyResult =
  | {
      applied: true;
      scope: "current" | "background";
      queryKey: QueryKey;
    }
  | {
      applied: false;
      reason: "destroyed" | "self-origin" | "rejected";
      queryKey: QueryKey;
    };

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
  /** Optional policy for normalized remote changes applied through applyRemote(). */
  remote?: RemoteConfig<TApiData, TUiData>;
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
  applyRemote: (change: RemoteChange<TApiData>) => RemoteApplyResult;
}
