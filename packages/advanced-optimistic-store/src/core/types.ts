// Core type definitions for the optimistic store pattern

import type { OptimisticStore } from "./OptimisticStore";

export interface Entity {
  id: string;
}

// Optimistic state configuration
export interface OptimisticDefaults<TUiData extends Entity> {
  /** Function to generate optimistic UI data from form input */
  createOptimisticUiData: (userInput: any, context?: any) => TUiData;
  /** Fields that should show loading/pending states instead of defaults */
  pendingFields?: (keyof TUiData)[];
}

// Transformation interface for API ↔ UI data conversion
export interface DataTransformer<
  TApiData extends Entity,
  TUiData extends Entity,
> {
  toUi(apiData: TApiData): TUiData;
  toApi(uiData: TUiData): TApiData;
  /** Optional: Define optimistic defaults */
  optimisticDefaults?: OptimisticDefaults<TUiData>;
}

export interface OptimisticStoreConfig<
  TApiData extends Entity,
  TUiData extends Entity = TApiData,
> {
  /** Unique identifier for this data type (used for query keys) */
  name: string;
  /** Function to fetch all items - same as TanStack Query queryFn. Can be dynamic to capture current context. */
  queryFn: () => Promise<TApiData[]>;
  /** Mutation functions for CRUD operations. Can be dynamic to capture current context. */
  mutations: {
    create: (data: any) => Promise<TApiData>;
    update: (params: { id: string; data: any }) => Promise<TApiData>;
    remove: (id: string) => Promise<{ id: string } | void>;
  };
  /** Optional: Transform data between API and UI formats. Defaults to createDefaultTransformer() if not provided. Set to false to disable transformation. */
  transformer?: DataTransformer<TApiData, TUiData> | false;
  /** Optional: Optimistic defaults configuration (can be provided here or in transformer) */
  optimisticDefaults?: OptimisticDefaults<TUiData>;
  /** Optional: Function to get current context data for optimistic updates (e.g., current user, app state) */
  optimisticContext?: () => any;
  /** Optional: Custom store class (creates basic OptimisticStore if not provided) */
  storeClass?: new () => OptimisticStore<TUiData>;
  /** Optional: Cache time in milliseconds (default: 5 minutes) */
  staleTime?: number;
  /** Optional: Function to determine if query should be enabled (default: () => true) */
  enabled?: () => boolean;
  /** Optional: Realtime configuration - enables realtime updates when provided */
  realtime?: {
    /** Event type to listen for (e.g., "checkbox_update", "post_update") */
    eventType: string;
    /** Optional: Function to extract data from event. Defaults to (event) => event.data */
    dataExtractor?: (event: any) => TUiData | undefined;
    /** Optional: Function to determine if event should be processed */
    shouldProcessEvent?: (event: any) => boolean;
    /** Optional: Browser ID to filter out self-originated events (prevents echo) */
    browserId?: string;
    /** Optional: Custom handler for specific event types */
    customHandlers?: {
      [eventType: string]: (
        store: OptimisticStore<TUiData>,
        event: any,
      ) => void;
    };
  };
}

export interface OptimisticStoreManager<
  TApiData extends Entity,
  TUiData extends Entity,
  TStore extends OptimisticStore<TUiData> = OptimisticStore<TUiData>,
> {
  store: TStore;
  actions: {
    // These actions perform both UI updates AND server updates (optimistic)
    create: (data: any) => Promise<TApiData>;
    update: (params: { id: string; data: any }) => Promise<TApiData>;
    remove: (id: string) => Promise<void | { id: string }>;
    refetch: () => Promise<any>;
    triggerQuery: () => void;
  };
  status: {
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    isSyncing: boolean;
    createPending: boolean;
    updatePending: boolean;
    deletePending: boolean;
  };
  updateOptions: () => void;
  isEnabled: () => boolean;
  enable: () => void;
  disable: () => void;
  destroy: () => void;
  // Realtime status (only available when realtime config is provided)
  realtime?: {
    isConnected: boolean;
    connect: (socket: any) => void;
    disconnect: () => void;
  };
}
