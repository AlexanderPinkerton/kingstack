// Core type definitions for the optimistic store pattern

import type { ObservableUIData } from "./ObservableUIData";

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
  /** Optional: Custom store class (creates basic ObservableUIData if not provided) */
  storeClass?: new () => ObservableUIData<TUiData>;
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
        store: ObservableUIData<TUiData>,
        event: any,
      ) => void;
    };
  };
}

export interface OptimisticStore<
  TApiData extends Entity,
  TUiData extends Entity,
  TStore extends ObservableUIData<TUiData> = ObservableUIData<TUiData>,
> {
  // UI domain - observable MobX state
  ui: TStore;

  // API domain - TanStack Query + mutations
  api: {
    // Optimistic mutations
    create: (data: any) => Promise<TApiData>;
    update: (id: string, data: any) => Promise<TApiData>;
    remove: (id: string) => Promise<void | { id: string }>;

    // Query control
    refetch: () => Promise<any>;
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
    connect: (socket: any) => void;
    disconnect: () => void;
  };
}
