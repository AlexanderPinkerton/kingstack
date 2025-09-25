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
} from "@tanstack/query-core";

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
  public optimisticDeletions: Set<string> = new Set(); // Track items being deleted optimistically

  constructor() {
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

  // Basic operations
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
    this.optimisticDeletions.add(id); // Track this as an optimistic deletion
    console.log("optimistic delete tracked:", id, "current deletions:", Array.from(this.optimisticDeletions));
  }

  // Remove item without tracking as optimistic deletion (for server-side removals)
  removeFromServer(id: string): void {
    this.entities.delete(id);
    console.log("server-side removal:", id);
  }

  clear(): void {
    this.entities.clear();
    this.optimisticDeletions.clear();
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

  // Server reconciliation - diff-based update that preserves optimistic updates
  reconcile<TApiData extends Entity = T>(
    serverData: TApiData[],
    transformer?: DataTransformer<TApiData, T>,
  ): void {
    // Convert server data to UI format
    const serverUiData = serverData.map((apiItem) => {
      if (transformer) {
        return transformer.toUi(apiItem);
      } else {
        return apiItem as unknown as T;
      }
    });

    console.log("reconciliation: server returned", serverUiData.length, "items:", serverUiData.map(item => item.id));

    // Create a map of server data for quick lookup
    const serverDataMap = new Map(serverUiData.map(item => [item.id, item]));

    // Get current items that are NOT optimistic (exist on server)
    const currentServerItems = this.list.filter(item => {
      const serverItem = serverDataMap.get(item.id);
      return !!serverItem; // This item exists on server
    });

    // Get optimistic items (don't exist on server yet)
    const optimisticItems = this.list.filter(item => {
      const serverItem = serverDataMap.get(item.id);
      return !serverItem; // This item doesn't exist on server yet
    });

    // 1. Upsert all server data (updates existing + adds new)
    // BUT skip items that are being optimistically deleted
    serverUiData.forEach(item => {
      if (!this.optimisticDeletions.has(item.id)) {
        this.upsert(item);
        console.log("reconciled: added/updated item", item.id);
      } else {
        console.log("reconciled: skipped optimistically deleted item", item.id);
      }
    });

    // 2. Clear optimistic deletions for items that are confirmed deleted on server
    const serverIds = new Set(serverUiData.map(item => item.id));
    const confirmedDeletedIds: string[] = [];
    this.optimisticDeletions.forEach(id => {
      if (!serverIds.has(id)) {
        // Item is not on server anymore, deletion is confirmed
        this.optimisticDeletions.delete(id);
        confirmedDeletedIds.push(id);
      }
    });
    if (confirmedDeletedIds.length > 0) {
      console.log("reconciled: confirmed deletions on server:", confirmedDeletedIds);
    }

    // 3. Remove items that no longer exist on server (but keep optimistic ones)
    const optimisticIds = new Set(optimisticItems.map(item => item.id));
    
    // Only remove items that were on server before but aren't anymore
    currentServerItems.forEach(item => {
      if (!serverIds.has(item.id)) {
        this.removeFromServer(item.id);
      }
    });

    // Clear snapshots after successful sync
    this.snapshots = [];
    console.log("reconciled", this.list, "optimistic items preserved:", optimisticItems.length, "optimistic deletions:", Array.from(this.optimisticDeletions));
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
export function createTransformer<TApiData extends Entity, TUiData extends Entity>(
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
}

// ---------- Framework-Agnostic Store Manager ----------

export interface OptimisticStoreManager<
  TApiData extends Entity,
  TUiData extends Entity,
  TStore extends OptimisticStore<TUiData> = OptimisticStore<TUiData>,
> {
  store: TStore;
  actions: {
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
  // Use provided query client or create a new one
  const qc = queryClient || new QueryClient();

  // Create store instance
  const StoreClass = (config.storeClass as any) || OptimisticStore<TUiData>;
  const store = new StoreClass() as TStore;

  // Create transformer
  const transformer = createTransformer(config.transformer);

  // Status tracking - make it observable so React components re-render
  const status = observable({
    isLoading: false,
    isError: false,
    error: null as Error | null,
    isSyncing: false,
    createPending: false,
    updatePending: false,
    deletePending: false,
  });

  // Create query observer for data fetching
  const queryObserver = new QueryObserver(qc, {
    queryKey: [config.name],
    queryFn: config.queryFn,
    staleTime: config.staleTime ?? 5 * 60 * 1000,
    enabled: config.enabled ? config.enabled() : true,
  });

  // Subscribe to query changes
  const unsubscribeQuery = queryObserver.subscribe((result) => {
    runInAction(() => {
      status.isLoading = result.isLoading;
      status.isError = result.isError;
      status.error = result.error as Error | null;
      status.isSyncing = result.isFetching;
    });

    if (result.data) {
      runInAction(() => {
        store.reconcile(result.data!, transformer);
      });
    }
  });

  // Auto-trigger query when enabled (like React hooks do)
  const triggerQuery = () => {
    if (config.enabled ? config.enabled() : true) {
      queryObserver.refetch();
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

  // Create mutation observers
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
          const context = config.optimisticContext ? config.optimisticContext() : undefined;
          optimisticItem = optimisticDefaults.createOptimisticUiData(data, context);
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

      runInAction(() => {
        store.upsert(optimisticItem);
      });

      return { tempId };
    },
    onSuccess: (result: TApiData, variables: any, context: any) => {
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
    },
    onError: () => {
      runInAction(() => {
        store.rollback();
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
      runInAction(() => {
            if (optimisticDefaults?.createOptimisticUiData) {
              // Get existing item to merge with updates
              const existingItem = store.get(id);
              if (existingItem) {
                // Create updated form data by merging existing + updates
                const updatedFormData = { ...existingItem, ...data };
                // Generate fresh optimistic UI data with recalculated fields
                const context = config.optimisticContext ? config.optimisticContext() : undefined;
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

      return { id, data };
    },
    onSuccess: (result: TApiData) => {
      runInAction(() => {
        if (transformer) {
          const uiData = transformer.toUi(result);
          store.upsert(uiData);
        } else {
          store.upsert(result as unknown as TUiData);
        }
      });
    },
    onError: () => {
      runInAction(() => {
        store.rollback();
      });
    },
  });

  const removeMutationObserver = new MutationObserver(qc, {
    mutationFn: config.mutations.remove,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: [config.name] });
      store.pushSnapshot();

      // Optimistic update
      runInAction(() => {
        store.remove(id);
      });

      return { id };
    },
    onSuccess: (result: { id: string } | void, variables: string) => {
      // Item already removed optimistically
      // DON'T clear from optimistic deletions yet - wait for server reconciliation
      // The reconciliation will handle clearing it when the server confirms the deletion
      console.log("delete mutation succeeded, keeping in optimistic deletions until server confirms:", variables);
      console.log("delete mutation result:", result);
    },
    onError: (error: any, variables: string) => {
      runInAction(() => {
        store.rollback();
        // Clear optimistic deletion on error
        store.optimisticDeletions.delete(variables);
        console.log("delete mutation failed, rolled back and cleared from optimistic deletions:", variables);
      });
    },
  });

  // Subscribe to mutation status changes
  const unsubscribeCreateMutation = createMutationObserver.subscribe(
    (result) => {
      runInAction(() => {
        status.createPending = result.isPending;
      });
    },
  );

  const unsubscribeUpdateMutation = updateMutationObserver.subscribe(
    (result) => {
      runInAction(() => {
        status.updatePending = result.isPending;
      });
    },
  );

  const unsubscribeRemoveMutation = removeMutationObserver.subscribe(
    (result) => {
      runInAction(() => {
        status.deletePending = result.isPending;
      });
    },
  );

  return {
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
      unsubscribeQuery();
      unsubscribeCreateMutation();
      unsubscribeUpdateMutation();
      unsubscribeRemoveMutation();
      // cleanupNaturalRefetch();
    },
  } as const;
}
