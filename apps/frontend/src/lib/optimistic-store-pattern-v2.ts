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

  // Server reconciliation
  reconcileFromServer(serverData: T[]): void {
    this.clear();
    serverData.forEach(item => this.upsert(item));
    this.snapshots = []; // Clear snapshots after successful sync
  }

  reconcileFromApiServer<TApiData extends Entity>(
    serverData: TApiData[], 
    transformer: DataTransformer<TApiData, T>
  ): void {
    this.clear();
    serverData.forEach(apiItem => {
      const uiItem = transformer.toUi(apiItem);
      this.upsert(uiItem);
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
  /** Optional: Transform data between API and UI formats */
  transformer?: DataTransformer<TApiData, TUiData>;
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
 * Basic usage:
 * ```ts
 * const useTodos = createOptimisticStore({
 *   name: 'todos',
 *   queryFn: () => fetchWithAuth(token, '/todos').then(res => res.json()),
 *   mutations: {
 *     create: (data) => fetchWithAuth(token, '/todos', { method: 'POST', body: JSON.stringify(data) }).then(res => res.json()),
 *     update: ({ id, data }) => fetchWithAuth(token, `/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(res => res.json()),
 *     remove: (id) => fetchWithAuth(token, `/todos/${id}`, { method: 'DELETE' }).then(() => ({ id })),
 *   }
 * });
 * ```
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
          if (config.transformer) {
            storeRef.current!.reconcileFromApiServer(query.data!, config.transformer);
          } else {
            storeRef.current!.reconcileFromServer(query.data! as unknown as TUiData[]);
          }
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
          const uiData = config.transformer ? config.transformer.toUi(result) : result as unknown as TUiData;
          storeRef.current!.upsert(uiData);
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
          const uiData = config.transformer ? config.transformer.toUi(result) : result as unknown as TUiData;
          storeRef.current!.upsert(uiData);
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
