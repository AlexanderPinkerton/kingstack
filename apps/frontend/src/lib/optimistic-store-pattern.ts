// Simple MobX + TanStack Query Optimistic Store Pattern
// A minimal bridge between MobX stores and TanStack Query with automatic optimistic updates

import { makeAutoObservable, runInAction } from "mobx";
import React, { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ---------- Core Types ----------

export interface Entity {
  id: string;
}

// Transformation interface for API ↔ UI data conversion
export interface DataTransformer<TApiData extends Entity, TUiData extends Entity> {
  toUi(apiData: TApiData): TUiData;
  toApi(uiData: TUiData): TApiData;
  toApiUpdate(data: Partial<TUiData>): any;
}

// Default transformer for common data type conversions
export function createDefaultTransformer<TApiData extends Entity, TUiData extends Entity>(
  customTransform?: (apiData: TApiData) => Partial<TUiData>
): DataTransformer<TApiData, TUiData> {
  return {
    toUi(apiData: TApiData): TUiData {
      const baseTransform = {
        // Convert common API patterns to UI patterns
        id: (apiData as any).id || (apiData as any)._id || (apiData as any).ID,
        // Convert snake_case to camelCase
        ...Object.keys(apiData).reduce((acc, key) => {
          const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          acc[camelKey] = (apiData as any)[key];
          return acc;
        }, {} as any),
        // Apply custom transformations
        ...(customTransform ? customTransform(apiData) : {}),
      };
      return baseTransform as TUiData;
    },
    
    toApi(uiData: TUiData): TApiData {
      // Convert camelCase back to snake_case for API
      const apiData = Object.keys(uiData).reduce((acc, key) => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        acc[snakeKey] = (uiData as any)[key];
        return acc;
      }, {} as any);
      return apiData as TApiData;
    },
    
    toApiUpdate(data: Partial<TUiData>): any {
      // Convert partial UI data to API format
      return Object.keys(data).reduce((acc, key) => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        acc[snakeKey] = (data as any)[key];
        return acc;
      }, {} as any);
    },
  };
}

// ---------- MobX Store ----------

export class OptimisticStore<T extends Entity> {
  private entities = new Map<string, T>();
  private snapshots: Map<string, T>[] = [];

  constructor() {
    makeAutoObservable(this);
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
    transformer?: DataTransformer<TApiData, T>
  ): void {
    this.clear();
    serverData.forEach(apiItem => {
      if (transformer) {
        const uiItem = transformer.toUi(apiItem);
        this.upsert(uiItem);
      } else {
        // No transformation needed - data is already in UI shape
        this.upsert(apiItem as unknown as T);
      }
    });
    this.snapshots = []; // Clear snapshots after successful sync
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
  transformer: DataTransformer<TApiData, TUiData> | false | undefined
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

export interface OptimisticStoreConfig<TApiData extends Entity, TUiData extends Entity = TApiData> {
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
 * - Single reconcile() method handles all data transformation cases
 * - Smart transformer defaults: uses createDefaultTransformer() by default
 * - Easy customization: pass DataTransformer object or false to disable
 * - Automatic optimistic updates with rollback on errors
 * - Full TypeScript support
 * 
 * Transformer options:
 * - undefined (default): Uses createDefaultTransformer() for snake_case → camelCase conversion
 * - false: No transformation - data is already in UI shape
 * - DataTransformer object: Custom transformer conforming to DataTransformer interface
 */
export function createOptimisticStore<
  TApiData extends Entity,
  TUiData extends Entity = TApiData,
  TStore extends OptimisticStore<TUiData> = OptimisticStore<TUiData>
>(config: OptimisticStoreConfig<TApiData, TUiData>) {
  // Return a React hook that manages the store instance
  return function useOptimisticStore() {
    // Create store instance once using useRef to keep it stable across renders
    const storeRef = React.useRef<TStore | null>(null);
    if (!storeRef.current) {
      const StoreClass = config.storeClass as any || OptimisticStore<TUiData>;
      storeRef.current = new StoreClass() as TStore;
    }
    
    // Create transformer once using useRef to keep it stable across renders
    const transformerRef = React.useRef<DataTransformer<TApiData, TUiData> | undefined | null>(null);
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
        const optimisticItem = { id: tempId, ...data } as TUiData;
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
        
        // Optimistic update
        runInAction(() => {
          storeRef.current!.update(id, data);
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
