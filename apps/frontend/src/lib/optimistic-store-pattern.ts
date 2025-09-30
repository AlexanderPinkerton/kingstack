// Framework-Agnostic MobX + TanStack Query Core Optimistic Store Pattern
// A minimal bridge between MobX stores and TanStack Query Core with automatic optimistic updates

import {
  makeObservable,
  observable,
  computed,
  action,
  runInAction,
} from "mobx";
import {
  QueryClient,
  MutationObserver,
  QueryObserver,
  notifyManager,
} from "@tanstack/query-core";
import { createRealtimeExtension, RealtimeExtension } from "./realtime-extension";

// ---------- Core Types ----------

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

// Default transformer for common data type conversions
export function createDefaultTransformer<
  TApiData extends Entity,
  TUiData extends Entity,
>(): DataTransformer<TApiData, TUiData> {
  return {
    toUi(apiData: TApiData): TUiData {
      const baseTransform = {
        // Convert common API patterns to UI patterns
        id: (apiData as any).id || (apiData as any)._id || (apiData as any).ID,
        // Apply smart type conversions while keeping original field names
        ...Object.keys(apiData).reduce((acc, key) => {
          const value = (apiData as any)[key];

          // Smart type conversions
          if (typeof value === "string") {
            // Convert ISO date strings to Date objects
            if (
              key.includes("date") ||
              key.includes("time") ||
              key.includes("at") ||
              ((key.includes("created") || key.includes("updated")) &&
                key.includes("_"))
            ) {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                acc[key] = date;
                return acc;
              }
            }

            // Convert boolean strings to boolean values
            if (value === "true" || value === "false") {
              acc[key] = value === "true";
              return acc;
            }

            // Convert number strings to numbers
            if (!isNaN(Number(value)) && value !== "") {
              acc[key] = Number(value);
              return acc;
            }

            // Convert CSV strings to arrays
            if (value.includes(",") && !value.includes(" ")) {
              acc[key] = value.split(",").map((item) => item.trim());
              return acc;
            }
          }

          // Default: keep the original key and value
          acc[key] = value;
          return acc;
        }, {} as any),
      };
      return baseTransform as TUiData;
    },

    toApi(uiData: TUiData): TApiData {
      // Handle reverse conversions while keeping original field names
      const apiData = Object.keys(uiData).reduce((acc, key) => {
        const value = (uiData as any)[key];

        // Reverse conversions for API
        if (value instanceof Date) {
          // Convert Date objects back to ISO strings
          acc[key] = value.toISOString();
        } else if (Array.isArray(value)) {
          // Convert arrays back to CSV strings
          acc[key] = value.join(",");
        } else if (typeof value === "boolean") {
          // Convert booleans back to strings
          acc[key] = value.toString();
        } else if (typeof value === "number") {
          // Keep numbers as numbers (or convert to string if API expects strings)
          acc[key] = value;
        } else {
          // Default: keep the value as is
          acc[key] = value;
        }

        return acc;
      }, {} as any);
      return apiData as TApiData;
    },
  };
}

// ---------- MobX Store ----------

export class OptimisticStore<T extends Entity> {
  /*
   * All observables must be public or you must use this syntax to make them observable
   * ----OR----
   * This can be overcome by explicitly passing the relevant private fields as generic argument, like this:
   * makeObservable<MyStore, "privateField" | "privateField2">(this, { privateField: observable, privateField2: observable })
   */
  public entities = new Map<string, T>();
  private snapshots: Map<string, T>[] = [];
  private transformer?: DataTransformer<any, T>;

  constructor(transformer?: DataTransformer<any, T>) {
    this.transformer = transformer;
    makeObservable(this, {
      entities: observable,
      list: computed,
      count: computed,
      upsert: action,
      update: action,
      remove: action,
      clear: action,
      pushSnapshot: action,
      rollback: action,
      reconcile: action,
    });
  }

  // Computed properties
  get list(): T[] {
    return Array.from(this.entities.values());
  }

  get count(): number {
    return this.entities.size;
  }

  // Basic operations (used internally and by manager actions)
  get(id: string): T | undefined {
    return this.entities.get(id);
  }

  upsert(entity: T): void {
    this.entities.set(entity.id, entity);
  }

  update(id: string, updates: Partial<T>): void {
    const existing = this.entities.get(id);
    if (existing) {
      this.entities.set(id, { ...existing, ...updates });
    }
  }

  remove(id: string): void {
    this.entities.delete(id);
  }


  clear(): void {
    this.entities.clear();
  }

  // MobX-aware methods for realtime updates (UI-only, server already updated)
  // These methods handle runInAction internally so the realtime extension doesn't need MobX
  upsertFromRealtime<TApiData extends Entity>(apiData: TApiData): void {
    runInAction(() => {
      const uiData = this.transformer ? this.transformer.toUi(apiData) : (apiData as unknown as T);
      this.upsert(uiData);
    });
  }

  removeFromRealtime(id: string): void {
    runInAction(() => {
      this.remove(id);
    });
  }

  // Optimistic update support
  pushSnapshot(): void {
    const snapshot = new Map(this.entities);
    this.snapshots.push(snapshot);
  }

  rollback(): void {
    const snapshot = this.snapshots.pop();
    if (snapshot) {
      this.entities = snapshot;
    }
  }

  // Server reconciliation - optimized diffing approach
  reconcile<TApiData extends Entity = T>(
    serverData: TApiData[],
    transformer?: DataTransformer<TApiData, T>,
  ): void {
    // Create a map of server data for efficient lookup
    const serverDataMap = new Map<string, T>();

    for (const apiItem of serverData) {
      const uiItem = transformer
        ? transformer.toUi(apiItem)
        : (apiItem as unknown as T);
      serverDataMap.set(uiItem.id, uiItem);
    }

    // Only update if data has actually changed
    const currentIds = new Set(this.entities.keys());
    const serverIds = new Set(serverDataMap.keys());

    // Check if we need to do a full reconciliation
    const needsFullReconcile =
      currentIds.size !== serverIds.size ||
      [...currentIds].some((id) => !serverIds.has(id)) ||
      [...serverIds].some((id) => !currentIds.has(id)) ||
      [...serverIds].some((id) => {
        const current = this.entities.get(id);
        const server = serverDataMap.get(id);
        return !current || !server || !this.shallowEqual(current, server);
      });

    if (!needsFullReconcile) {
      console.log("reconciled: no changes detected, skipping update");
      return;
    }

    // Clear snapshots only when doing full reconciliation
    this.snapshots = [];

    // Update entities efficiently
    runInAction(() => {
      // Remove entities that are no longer in server data
      for (const [id] of this.entities) {
        if (!serverDataMap.has(id)) {
          this.entities.delete(id);
        }
      }

      // Add or update entities from server data
      for (const [id, uiItem] of serverDataMap) {
        this.entities.set(id, uiItem);
      }
    });

    console.log(
      "reconciled: updated with",
      this.list.length,
      "items from server",
    );
  }

  // Optimized shallow equality comparison with early exit and type checking
  private shallowEqual(a: T, b: T): boolean {
    // Quick reference equality check first
    if (a === b) return true;

    // Handle null/undefined cases
    if (a == null || b == null) return a === b;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    // Quick length check
    if (keysA.length !== keysB.length) return false;

    // Early exit for empty objects
    if (keysA.length === 0) return true;

    // Optimized comparison with type checking
    for (let i = 0; i < keysA.length; i++) {
      const key = keysA[i];
      const valA = (a as any)[key];
      const valB = (b as any)[key];

      // Quick reference equality
      if (valA === valB) continue;

      // Handle Date objects
      if (valA instanceof Date && valB instanceof Date) {
        if (valA.getTime() !== valB.getTime()) return false;
        continue;
      }

      // Handle arrays
      if (Array.isArray(valA) && Array.isArray(valB)) {
        if (valA.length !== valB.length) return false;
        for (let j = 0; j < valA.length; j++) {
          if (valA[j] !== valB[j]) return false;
        }
        continue;
      }

      // Handle objects (shallow)
      if (
        typeof valA === "object" &&
        typeof valB === "object" &&
        valA !== null &&
        valB !== null
      ) {
        const valAKeys = Object.keys(valA);
        const valBKeys = Object.keys(valB);
        if (valAKeys.length !== valBKeys.length) return false;
        for (const valKey of valAKeys) {
          if ((valA as any)[valKey] !== (valB as any)[valKey]) return false;
        }
        continue;
      }

      // Default strict equality
      if (valA !== valB) return false;
    }

    return true;
  }

  // Utility methods
  filter(predicate: (entity: T) => boolean): T[] {
    return this.list.filter(predicate);
  }

  find(predicate: (entity: T) => boolean): T | undefined {
    return this.list.find(predicate);
  }
}

// ---------- Helper Functions ----------

/**
 * Creates the appropriate transformer based on config
 */
export function createTransformer<
  TApiData extends Entity,
  TUiData extends Entity,
>(
  transformer: DataTransformer<TApiData, TUiData> | false | undefined,
): DataTransformer<TApiData, TUiData> | undefined {
  if (transformer === false) {
    // No transformation needed - data is already in UI shape
    return undefined;
  } else if (transformer) {
    // Custom transformer provided
    return transformer;
  } else {
    // No transformer specified - use default transformer
    return createDefaultTransformer<TApiData, TUiData>();
  }
}

// ---------- Query Client Singleton ----------

// Global query client singleton to avoid creating multiple instances
let globalQueryClient: QueryClient | null = null;

export function getGlobalQueryClient(): QueryClient {
  if (!globalQueryClient) {
    globalQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Optimize default settings for better performance
          staleTime: 5 * 60 * 1000, // 5 minutes
          gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
          retry: 1, // Reduce retries for better UX
          refetchOnWindowFocus: false, // Disable to reduce unnecessary requests
          refetchOnReconnect: true,
        },
        mutations: {
          retry: 1,
        },
      },
    });
  }
  return globalQueryClient;
}

// ---------- Store Manager Cache ----------
// NOTE: Store manager caching was removed because:
// 1. Store managers are cheap to create (~5-10ms)
// 2. TanStack Query already caches query results (the expensive part)
// 3. Caching store managers breaks dynamic closures (auth tokens, context)
// 4. Adds unnecessary complexity
//
// TanStack Query caches by queryKey automatically, so repeated calls
// with the same queryKey will return cached data without network requests.
// That's the optimization that matters!

// ---------- Main API ----------

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

// ---------- Framework-Agnostic Store Manager ----------

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

/**
 * Creates a fully configured framework-agnostic optimistic store with minimal setup.
 * Just provide your query function and mutation functions - no API wrapper needed!
 *
 * Features:
 * - Direct form data → optimistic UI data transformation
 * - Smart transformer for server data reconciliation
 * - Automatic optimistic updates with rollback on errors
 * - Flexible pending field states for server-generated data
 * - Full TypeScript support
 * - Framework agnostic (works with React, Vue, Svelte, etc.)
 *
 * Optimistic Update Flow:
 * 1. User submits form data
 * 2. createOptimisticUiData() transforms form data to complete UI data
 * 3. UI updates immediately with optimistic data
 * 4. Server processes same form data
 * 5. Transformer converts server response to UI data
 * 6. Optimistic data replaced with authoritative server data
 */
export function createOptimisticStoreManager<
  TApiData extends Entity,
  TUiData extends Entity = TApiData,
  TStore extends OptimisticStore<TUiData> = OptimisticStore<TUiData>,
>(
  config: OptimisticStoreConfig<TApiData, TUiData>,
  queryClient?: QueryClient,
): OptimisticStoreManager<TApiData, TUiData, TStore> {
  // Store managers are NOT cached - they're cheap to create (~5-10ms)
  // TanStack Query caches query RESULTS by queryKey (config.name)
  // That's where the real performance gain is (avoiding 100-500ms network requests)

  // Use provided query client or get the global singleton
  const qc = queryClient || getGlobalQueryClient();

  // Create transformer
  const transformer = createTransformer(config.transformer);

  // Create store instance
  const StoreClass = (config.storeClass as any) || OptimisticStore<TUiData>;
  const store = new StoreClass(transformer) as TStore;

  // Create realtime extension if config provided (but don't connect yet)
  let realtimeExtension: RealtimeExtension<TUiData> | null = null;
  if (config.realtime) {
    realtimeExtension = createRealtimeExtension<TUiData>(
      store,
      config.realtime.eventType,
      {
        dataExtractor: config.realtime.dataExtractor,
        shouldProcessEvent: config.realtime.shouldProcessEvent,
        browserId: config.realtime.browserId,
        customHandlers: config.realtime.customHandlers,
      }
    );
    // Note: Connection will be handled by rootStore when socket is ready
  }

  // Status tracking - make it observable so React components re-render
  const status = observable({
    isLoading: false,
    isError: false,
    error: null as Error | null,
    isSyncing: false,
    createPending: false,
    updatePending: false,
    deletePending: false,
    // Track if any mutation is in flight (for realtime coordination)
    get hasPendingMutations(): boolean {
      return this.createPending || this.updatePending || this.deletePending;
    },
  });

  // Create query observer for data fetching
  const queryObserver = new QueryObserver(qc, {
    queryKey: [config.name],
    queryFn: config.queryFn,
    staleTime: config.staleTime ?? 5 * 60 * 1000,
    enabled: config.enabled ? config.enabled() : true,
  });

  // Subscribe to query changes with optimized reconciliation
  let lastReconciledData: TApiData[] | undefined;

  const unsubscribeQuery = queryObserver.subscribe((result) => {
    runInAction(() => {
      status.isLoading = result.isLoading;
      status.isError = result.isError;
      status.error = result.error as Error | null;
      status.isSyncing = result.isFetching;
    });

    // 🛡️ PROTECTION 3: Skip reconciliation if mutations are in flight
    // This prevents race conditions where reconciliation wipes out optimistic updates
    if (status.hasPendingMutations) {
      console.log(
        `⏸️ Skipping reconciliation while mutations are pending`,
      );
      return;
    }

    // Only reconcile when we have fresh, non-stale data and it's actually different
    if (result.data && !result.isStale && !result.isFetching) {
      // More efficient data change detection
      const dataChanged =
        !lastReconciledData ||
        lastReconciledData.length !== result.data.length ||
        // Quick ID check first (most common case)
        lastReconciledData.some((item, index) => {
          const newItem = result.data![index];
          return !newItem || item.id !== newItem.id;
        }) ||
        // Only do deep comparison if IDs match but data might be different
        (lastReconciledData.length === result.data.length &&
          lastReconciledData.every((item, index) => {
            const newItem = result.data![index];
            return newItem && item.id === newItem.id;
          }) &&
          JSON.stringify(lastReconciledData) !== JSON.stringify(result.data));

      if (dataChanged) {
        lastReconciledData = result.data;
        runInAction(() => {
          store.reconcile(result.data!, transformer);
        });
      }
    }
  });

  // Auto-trigger query when enabled (like React hooks do) with debouncing
  let triggerTimeout: NodeJS.Timeout | null = null;
  const triggerQuery = () => {
    if (config.enabled ? config.enabled() : true) {
      // Debounce rapid trigger calls to prevent excessive refetches
      if (triggerTimeout) {
        clearTimeout(triggerTimeout);
      }
      triggerTimeout = setTimeout(() => {
        queryObserver.refetch();
        triggerTimeout = null;
      }, 10); // 10ms debounce
    }
  };

  // Check if query is currently enabled
  const isEnabled = () => {
    return config.enabled ? config.enabled() : true;
  };

  // Initial trigger
  triggerQuery();

  // // Add natural refetch triggers (like pure TanStack Query)
  // const setupNaturalRefetch = () => {
  //   // Refetch on window focus (like useQuery)
  //   const handleWindowFocus = () => {
  //     if (isEnabled()) {
  //       queryObserver.refetch();
  //     }
  //   };

  //   // Refetch on network reconnect (like useQuery)
  //   const handleOnline = () => {
  //     if (isEnabled()) {
  //       queryObserver.refetch();
  //     }
  //   };

  //   // Add event listeners
  //   window.addEventListener('focus', handleWindowFocus);
  //   window.addEventListener('online', handleOnline);

  //   // Return cleanup function
  //   return () => {
  //     window.removeEventListener('focus', handleWindowFocus);
  //     window.removeEventListener('online', handleOnline);
  //   };
  // };

  // // Setup natural refetch triggers
  // const cleanupNaturalRefetch = setupNaturalRefetch();

  // Note: TanStack Query already handles stale time automatically
  // The stale time is configured in the query observer options above
  // No additional setup needed for stale time behavior

  // Create mutation observers with optimized batching
  const createMutationObserver = new MutationObserver(qc, {
    mutationFn: config.mutations.create,
    onMutate: async (data: any) => {
      await qc.cancelQueries({ queryKey: [config.name] });
      store.pushSnapshot();

      // Optimistic update - add to store immediately
      const tempId = `temp-${Date.now()}`;

      // Create optimistic item with proper structure
      let optimisticItem: TUiData;

      // Get optimistic defaults from transformer or config
      const optimisticDefaults =
        transformer?.optimisticDefaults || config.optimisticDefaults;

      if (optimisticDefaults?.createOptimisticUiData) {
        // ✅ Direct UI data creation - the right way to do optimistic updates
        const context = config.optimisticContext
          ? config.optimisticContext()
          : undefined;
        optimisticItem = optimisticDefaults.createOptimisticUiData(
          data,
          context,
        );
      } else if (transformer) {
        // Fallback: minimal mock API data when no optimistic defaults provided
        const mockApiData = {
          id: tempId,
          ...data,
        } as TApiData;
        optimisticItem = transformer.toUi(mockApiData);
      } else {
        // No transformer or defaults - use form data as-is with temp ID
        optimisticItem = { id: tempId, ...data } as TUiData;
      }

      // Batch the optimistic update
      notifyManager.batch(() => {
        runInAction(() => {
          store.upsert(optimisticItem);
        });
      });

      return { tempId };
    },
    onSuccess: (result: TApiData, variables: any, context: any) => {
      // Batch the success update
      notifyManager.batch(() => {
        runInAction(() => {
          // Remove temp item and add real one
          store.remove(context.tempId);

          if (transformer) {
            const uiData = transformer.toUi(result);
            store.upsert(uiData);
          } else {
            store.upsert(result as unknown as TUiData);
          }
        });
      });
    },
    onError: () => {
      // Batch the error rollback
      notifyManager.batch(() => {
        runInAction(() => {
          store.rollback();
        });
      });
    },
  });

  const updateMutationObserver = new MutationObserver(qc, {
    mutationFn: config.mutations.update,
    onMutate: async ({ id, data }: { id: string; data: any }) => {
      await qc.cancelQueries({ queryKey: [config.name] });
      store.pushSnapshot();

      // Get optimistic defaults for updates
      const optimisticDefaults =
        transformer?.optimisticDefaults || config.optimisticDefaults;

      // Optimistic update with proper UI data calculation
      notifyManager.batch(() => {
        runInAction(() => {
          if (optimisticDefaults?.createOptimisticUiData) {
            // Get existing item to merge with updates
            const existingItem = store.get(id);
            if (existingItem) {
              // Create updated form data by merging existing + updates
              const updatedFormData = { ...existingItem, ...data };
              // Generate fresh optimistic UI data with recalculated fields
              const context = config.optimisticContext
                ? config.optimisticContext()
                : undefined;
              const optimisticItem = optimisticDefaults.createOptimisticUiData(
                updatedFormData,
                context,
              );
              // Preserve the original ID (don't generate new temp ID)
              optimisticItem.id = id;
              store.upsert(optimisticItem);
            }
          } else {
            // Fallback: basic update without recalculated fields
            store.update(id, data);
          }
        });
      });

      return { id, data };
    },
    onSuccess: (result: TApiData) => {
      notifyManager.batch(() => {
        runInAction(() => {
          if (transformer) {
            const uiData = transformer.toUi(result);
            store.upsert(uiData);
          } else {
            store.upsert(result as unknown as TUiData);
          }
        });
      });
    },
    onError: () => {
      notifyManager.batch(() => {
        runInAction(() => {
          store.rollback();
        });
      });
    },
  });

  const removeMutationObserver = new MutationObserver(qc, {
    mutationFn: config.mutations.remove,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: [config.name] });
      store.pushSnapshot();

      // Optimistic update
      notifyManager.batch(() => {
        runInAction(() => {
          store.remove(id);
        });
      });

      return { id };
    },
    onSuccess: (result: { id: string } | void, variables: string) => {
      // Item already removed optimistically
      // DON'T clear from optimistic deletions yet - wait for server reconciliation
      // The reconciliation will handle clearing it when the server confirms the deletion
      console.log(
        "delete mutation succeeded, keeping in optimistic deletions until server confirms:",
        variables,
      );
      console.log("delete mutation result:", result);
    },
    onError: (error: any, variables: string) => {
      notifyManager.batch(() => {
        runInAction(() => {
          store.rollback();
          console.log(
            "delete mutation failed, rolled back and cleared from optimistic deletions:",
            variables,
          );
        });
      });
    },
  });

  // Subscribe to mutation status changes with batching
  const unsubscribeCreateMutation = createMutationObserver.subscribe(
    notifyManager.batchCalls((result) => {
      runInAction(() => {
        status.createPending = result.isPending;
      });
    }),
  );

  const unsubscribeUpdateMutation = updateMutationObserver.subscribe(
    notifyManager.batchCalls((result) => {
      runInAction(() => {
        status.updatePending = result.isPending;
      });
    }),
  );

  const unsubscribeRemoveMutation = removeMutationObserver.subscribe(
    notifyManager.batchCalls((result) => {
      runInAction(() => {
        status.deletePending = result.isPending;
      });
    }),
  );

  const storeManager = {
    store: store,
    actions: {
      create: (data: any) => createMutationObserver.mutate(data),
      update: (params: { id: string; data: any }) =>
        updateMutationObserver.mutate(params),
      remove: (id: string) => removeMutationObserver.mutate(id),
      refetch: () => queryObserver.refetch(),
      triggerQuery: () => triggerQuery(),
    },
    status,
    updateOptions: () => {
      // Update query options with current enabled state
      queryObserver.setOptions({
        queryKey: [config.name],
        queryFn: config.queryFn,
        staleTime: config.staleTime ?? 5 * 60 * 1000,
        enabled: config.enabled ? config.enabled() : true,
      });

      // Re-trigger query if now enabled (like React hooks do)
      triggerQuery();
    },
    isEnabled: () => isEnabled(),
    enable: () => {
      queryObserver.setOptions({
        queryKey: [config.name],
        queryFn: config.queryFn,
        staleTime: config.staleTime ?? 5 * 60 * 1000,
        enabled: true,
      });
      triggerQuery();
    },
    disable: () => {
      queryObserver.setOptions({
        queryKey: [config.name],
        queryFn: config.queryFn,
        staleTime: config.staleTime ?? 5 * 60 * 1000,
        enabled: false,
      });
    },
    destroy: () => {
      // Clear any pending trigger timeout
      if (triggerTimeout) {
        clearTimeout(triggerTimeout);
        triggerTimeout = null;
      }

      // Disconnect realtime if connected
      if (realtimeExtension) {
        realtimeExtension.disconnect();
      }

      unsubscribeQuery();
      unsubscribeCreateMutation();
      unsubscribeUpdateMutation();
      unsubscribeRemoveMutation();
      // cleanupNaturalRefetch();
    },
    // Realtime status (only available when realtime config is provided)
    ...(realtimeExtension && {
      realtime: {
        get isConnected() {
          return realtimeExtension!.connected;
        },
        connect: (socket: any) => {
          realtimeExtension!.connect(socket);
        },
        disconnect: () => {
          realtimeExtension!.disconnect();
        },
      },
    }),
  } as const;

  return storeManager;
}
