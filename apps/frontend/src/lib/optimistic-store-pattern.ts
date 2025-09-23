// Simple MobX + TanStack Query Optimistic Store Pattern
// A minimal bridge between MobX stores and TanStack Query with automatic optimistic updates

import {
  makeAutoObservable,
  makeObservable,
  observable,
  computed,
  action,
  runInAction,
} from "mobx";
import React, { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ---------- Core Types ----------

export interface Entity {
  id: string;
}

// Optimistic state configuration
export interface OptimisticDefaults<
  TApiData extends Entity,
  TUiData extends Entity,
> {
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
  optimisticDefaults?: OptimisticDefaults<TApiData, TUiData>;
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
  }

  clear(): void {
    this.entities.clear();
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

  // Server reconciliation - unified function that handles all cases
  reconcile<TApiData extends Entity = T>(
    serverData: TApiData[],
    transformer?: DataTransformer<TApiData, T>,
  ): void {
    this.clear();
    serverData.forEach((apiItem) => {
      if (transformer) {
        const uiItem = transformer.toUi(apiItem);
        this.upsert(uiItem);
      } else {
        // No transformation needed - data is already in UI shape
        this.upsert(apiItem as unknown as T);
      }
    });
    this.snapshots = []; // Clear snapshots after successful sync
    console.log("reconciled", this.list);
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
function createTransformer<TApiData extends Entity, TUiData extends Entity>(
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
  /** Function to fetch all items - same as TanStack Query queryFn */
  queryFn: () => Promise<TApiData[]>;
  /** Mutation functions for CRUD operations */
  mutations: {
    create: (data: any) => Promise<TApiData>;
    update: (params: { id: string; data: any }) => Promise<TApiData>;
    remove: (id: string) => Promise<{ id: string } | void>;
  };
  /** Optional: Transform data between API and UI formats. Defaults to createDefaultTransformer() if not provided. Set to false to disable transformation. */
  transformer?: DataTransformer<TApiData, TUiData> | false;
  /** Optional: Optimistic defaults configuration (can be provided here or in transformer) */
  optimisticDefaults?: OptimisticDefaults<TApiData, TUiData>;
  /** Optional: Context data for optimistic updates (e.g., current user, app state) */
  optimisticContext?: any;
  /** Optional: Custom store class (creates basic OptimisticStore if not provided) */
  storeClass?: new () => OptimisticStore<TUiData>;
  /** Optional: Cache time in milliseconds (default: 5 minutes) */
  staleTime?: number;
  /** Optional: Enable/disable the query (default: true) */
  enabled?: boolean;
}

/**
 * Creates a fully configured optimistic store with minimal setup.
 * Just provide your query function and mutation functions - no API wrapper needed!
 *
 * Features:
 * - Direct form data → optimistic UI data transformation
 * - Smart transformer for server data reconciliation
 * - Automatic optimistic updates with rollback on errors
 * - Flexible pending field states for server-generated data
 * - Full TypeScript support
 *
 * Optimistic Update Flow:
 * 1. User submits form data
 * 2. createOptimisticUiData() transforms form data to complete UI data
 * 3. UI updates immediately with optimistic data
 * 4. Server processes same form data
 * 5. Transformer converts server response to UI data
 * 6. Optimistic data replaced with authoritative server data
 */
export function createOptimisticStore<
  TApiData extends Entity,
  TUiData extends Entity = TApiData,
  TStore extends OptimisticStore<TUiData> = OptimisticStore<TUiData>,
>(config: OptimisticStoreConfig<TApiData, TUiData>) {
  // Return a React hook that manages the store instance
  return function useOptimisticStore() {
    // Create store instance once using useRef to keep it stable across renders
    const storeRef = React.useRef<TStore | null>(null);
    if (!storeRef.current) {
      const StoreClass = (config.storeClass as any) || OptimisticStore<TUiData>;
      storeRef.current = new StoreClass() as TStore;
    }

    // Create transformer once using useRef to keep it stable across renders
    const transformerRef = React.useRef<
      DataTransformer<TApiData, TUiData> | undefined | null
    >(null);
    if (transformerRef.current === null) {
      transformerRef.current = createTransformer(config.transformer);
    }

    // 1) Hydrate store from server
    const query = useQuery({
      queryKey: [config.name],
      queryFn: config.queryFn,
      staleTime: config.staleTime ?? 5 * 60 * 1000,
      enabled: config.enabled,
    });

    useEffect(() => {
      if (query.data) {
        runInAction(() => {
          storeRef.current!.reconcile(query.data!, transformerRef.current!);
        });
      }
    }, [query.data]);

    // 2) Set up mutations with optimistic updates
    const qc = useQueryClient();

    const create = useMutation({
      mutationFn: config.mutations.create,
      onMutate: async (data: any) => {
        await qc.cancelQueries({ queryKey: [config.name] });
        storeRef.current!.pushSnapshot();

        // Optimistic update - add to store immediately
        const tempId = `temp-${Date.now()}`;

        // Create optimistic item with proper structure
        let optimisticItem: TUiData;

        // Get optimistic defaults from transformer or config
        const optimisticDefaults =
          transformerRef.current?.optimisticDefaults ||
          config.optimisticDefaults;

        if (optimisticDefaults?.createOptimisticUiData) {
          // ✅ Direct UI data creation - the right way to do optimistic updates
          optimisticItem = optimisticDefaults.createOptimisticUiData(
            data,
            config.optimisticContext,
          );
        } else if (transformerRef.current) {
          // Fallback: minimal mock API data when no optimistic defaults provided
          const mockApiData = {
            id: tempId,
            ...data,
          } as TApiData;
          optimisticItem = transformerRef.current.toUi(mockApiData);
        } else {
          // No transformer or defaults - use form data as-is with temp ID
          optimisticItem = { id: tempId, ...data } as TUiData;
        }

        runInAction(() => {
          storeRef.current!.upsert(optimisticItem);
        });

        return { tempId };
      },
      onSuccess: (result: TApiData, variables: any, context: any) => {
        runInAction(() => {
          // Remove temp item and add real one
          storeRef.current!.remove(context.tempId);

          if (transformerRef.current) {
            const uiData = transformerRef.current.toUi(result);
            storeRef.current!.upsert(uiData);
          } else {
            storeRef.current!.upsert(result as unknown as TUiData);
          }
        });
      },
      onError: () => {
        runInAction(() => {
          storeRef.current!.rollback();
        });
      },
    });

    const update = useMutation({
      mutationFn: config.mutations.update,
      onMutate: async ({ id, data }: { id: string; data: any }) => {
        await qc.cancelQueries({ queryKey: [config.name] });
        storeRef.current!.pushSnapshot();

        // Get optimistic defaults for updates
        const optimisticDefaults =
          transformerRef.current?.optimisticDefaults ||
          config.optimisticDefaults;

        // Optimistic update with proper UI data calculation
        runInAction(() => {
          if (optimisticDefaults?.createOptimisticUiData) {
            // Get existing item to merge with updates
            const existingItem = storeRef.current!.get(id);
            if (existingItem) {
              // Create updated form data by merging existing + updates
              const updatedFormData = { ...existingItem, ...data };
              // Generate fresh optimistic UI data with recalculated fields
              const optimisticItem = optimisticDefaults.createOptimisticUiData(
                updatedFormData,
                config.optimisticContext,
              );
              // Preserve the original ID (don't generate new temp ID)
              optimisticItem.id = id;
              storeRef.current!.upsert(optimisticItem);
            }
          } else {
            // Fallback: basic update without recalculated fields
            storeRef.current!.update(id, data);
          }
        });

        return { id, data };
      },
      onSuccess: (result: TApiData) => {
        runInAction(() => {
          if (transformerRef.current) {
            const uiData = transformerRef.current.toUi(result);
            storeRef.current!.upsert(uiData);
          } else {
            storeRef.current!.upsert(result as unknown as TUiData);
          }
        });
      },
      onError: () => {
        runInAction(() => {
          storeRef.current!.rollback();
        });
      },
    });

    const remove = useMutation({
      mutationFn: config.mutations.remove,
      onMutate: async (id: string) => {
        await qc.cancelQueries({ queryKey: [config.name] });
        storeRef.current!.pushSnapshot();

        // Optimistic update
        runInAction(() => {
          storeRef.current!.remove(id);
        });

        return { id };
      },
      onSuccess: () => {
        // Item already removed optimistically
      },
      onError: () => {
        runInAction(() => {
          storeRef.current!.rollback();
        });
      },
    });

    return {
      store: storeRef.current,
      actions: {
        create: create.mutate,
        update: update.mutate,
        remove: remove.mutate,
        refetch: () => query.refetch(),
      },
      status: {
        isLoading: query.isLoading,
        isError: query.isError,
        error: (query.error as Error) ?? null,
        isSyncing: query.isFetching,
        createPending: create.isPending,
        updatePending: update.isPending,
        deletePending: remove.isPending,
      },
    } as const;
  };
}
