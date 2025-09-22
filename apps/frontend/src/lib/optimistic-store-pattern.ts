// Generic Optimistic Store Pattern
// A reusable framework for MobX + TanStack Query with optimistic updates

import { makeAutoObservable, runInAction } from "mobx";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

// ---------- Core Types ----------

export interface Entity {
  id: string;
}

export interface EntityAPI<T extends Entity, TCreate = Omit<T, "id">, TUpdate = Partial<T>> {
  list(): Promise<T[]>;
  create(data: TCreate): Promise<T>;
  update(id: string, data: TUpdate): Promise<T>;
  delete(id: string): Promise<{ id: string }>;
}

export interface OptimisticAction<TParams = any, TResult = any> {
  mutationFn: (params: TParams) => Promise<TResult>;
  onOptimistic?: (params: TParams, store: OptimisticStore<any>) => void;
  onSuccess?: (result: TResult, params: TParams, store: OptimisticStore<any>) => void;
  onError?: (error: Error, params: TParams, store: OptimisticStore<any>) => void;
}

// ---------- Generic Store ----------

export class OptimisticStore<T extends Entity> {
  entities = new Map<string, T>();
  private snapshots: Array<Map<string, T>> = [];
  private maxSnapshots = 10;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  // Core operations
  replaceAll(list: T[]) {
    const next = new Map<string, T>();
    list.forEach((entity) => next.set(entity.id, entity));
    this.entities = next;
  }

  reconcileFromServer(list: T[]) {
    const incomingById = new Map(list.map((entity) => [entity.id, entity] as const));
    const currentIds = new Set(this.entities.keys());
    const incomingIds = new Set(incomingById.keys());

    const sameCardinality = currentIds.size === incomingIds.size;
    const sameMembers = sameCardinality && [...currentIds].every((id) => incomingIds.has(id));

    if (sameMembers) {
      // Update values in place, preserving iteration order
      for (const id of this.entities.keys()) {
        const serverEntity = incomingById.get(id);
        if (serverEntity) this.entities.set(id, serverEntity);
      }
      return;
    }

    // If membership changed, fall back to replaceAll
    this.replaceAll(list);
  }

  upsert(entity: T) {
    this.entities.set(entity.id, entity);
  }

  update(id: string, updates: Partial<T>) {
    const existing = this.entities.get(id);
    if (existing) {
      this.entities.set(id, { ...existing, ...updates });
    }
  }

  remove(id: string) {
    this.entities.delete(id);
  }

  get(id: string): T | undefined {
    return this.entities.get(id);
  }

  // Optimistic helpers
  pushSnapshot() {
    if (this.snapshots.length >= this.maxSnapshots) {
      this.snapshots.shift(); // Remove oldest
    }
    const copy = new Map<string, T>();
    this.entities.forEach((v, k) => copy.set(k, { ...v }));
    this.snapshots.push(copy);
  }

  rollback() {
    const prev = this.snapshots.pop();
    if (prev) this.entities = prev;
  }

  commit() {
    this.snapshots.pop();
  }

  // Derived values
  get list(): T[] {
    return Array.from(this.entities.values());
  }

  get count(): number {
    return this.entities.size;
  }

  // Filtering helpers
  filter(predicate: (entity: T) => boolean): T[] {
    return this.list.filter(predicate);
  }

  find(predicate: (entity: T) => boolean): T | undefined {
    return this.list.find(predicate);
  }
}

// ---------- Controller Factory ----------

export interface ControllerConfig<T extends Entity, TCreate, TUpdate> {
  queryKey: string[];
  api: EntityAPI<T, TCreate, TUpdate>;
  store: OptimisticStore<T>;
  staleTime?: number;
  customActions?: Record<string, OptimisticAction>;
}

export function createEntityController<
  T extends Entity,
  TCreate = Omit<T, "id">,
  TUpdate = Partial<T>
>(config: ControllerConfig<T, TCreate, TUpdate>) {
  return function useEntityController() {
    const qc = useQueryClient();
    const { queryKey, api, store, staleTime = 5_000, customActions = {} } = config;

    // 1) Hydrate store from server
    const query = useQuery({
      queryKey,
      queryFn: api.list,
      staleTime,
    });

    useEffect(() => {
      if (query.data) {
        runInAction(() => {
          store.reconcileFromServer(query.data!);
        });
      }
    }, [query.data]);

    // 2) Standard mutations
    const create = useMutation({
      mutationFn: api.create,
      onMutate: async (data: TCreate) => {
        await qc.cancelQueries({ queryKey });
        store.pushSnapshot();
        
        // Create optimistic entity
        const tempId = `temp_${Math.random().toString(36).slice(2, 7)}`;
        const optimisticEntity = { id: tempId, ...data } as unknown as T;
        store.upsert(optimisticEntity);
        
        return { tempId };
      },
      onError: () => store.rollback(),
      onSuccess: (result: T, _vars: TCreate, ctx: any) => {
        if (ctx?.tempId) store.remove(ctx.tempId);
        store.upsert(result);
      },
      onSettled: () => {
        store.commit();
        qc.invalidateQueries({ queryKey });
      },
    });

    const update = useMutation({
      mutationFn: ({ id, data }: { id: string; data: TUpdate }) => api.update(id, data),
      onMutate: async ({ id, data }: { id: string; data: TUpdate }) => {
        await qc.cancelQueries({ queryKey });
        store.pushSnapshot();
        store.update(id, data as Partial<T>);
        return { id, data };
      },
      onError: () => store.rollback(),
      onSuccess: (result: T) => store.upsert(result),
      onSettled: () => {
        store.commit();
        qc.invalidateQueries({ queryKey });
      },
    });

    const remove = useMutation({
      mutationFn: api.delete,
      onMutate: async (id: string) => {
        await qc.cancelQueries({ queryKey });
        store.pushSnapshot();
        store.remove(id);
        return { id };
      },
      onError: () => store.rollback(),
      onSuccess: () => { /* already removed optimistically */ },
      onSettled: () => {
        store.commit();
        qc.invalidateQueries({ queryKey });
      },
    });

    // 3) Custom actions
    const customMutations = Object.entries(customActions).reduce((acc, [key, action]) => {
      acc[key] = useMutation({
        mutationFn: action.mutationFn,
        onMutate: async (params: any) => {
          await qc.cancelQueries({ queryKey });
          store.pushSnapshot();
          action.onOptimistic?.(params, store);
          return params;
        },
        onError: (error: Error, params: any) => {
          store.rollback();
          action.onError?.(error, params, store);
        },
        onSuccess: (result: any, params: any) => {
          action.onSuccess?.(result, params, store);
        },
        onSettled: () => {
          store.commit();
          qc.invalidateQueries({ queryKey });
        },
      });
      return acc;
    }, {} as Record<string, any>);

    // 4) Status aggregation
    const mutations = [create, update, remove, ...Object.values(customMutations)];
    const isPending = mutations.some(m => m.isPending);
    const isSyncing = isPending || query.isFetching;

    return {
      store,
      actions: {
        create: (data: TCreate) => create.mutate(data),
        update: (id: string, data: TUpdate) => update.mutate({ id, data }),
        remove: (id: string) => remove.mutate(id),
        refetch: () => query.refetch(),
        ...Object.entries(customMutations).reduce((acc, [key, mutation]) => {
          acc[key] = (params: any) => mutation.mutate(params);
          return acc;
        }, {} as Record<string, any>),
      },
      status: {
        isLoading: query.isLoading,
        isError: query.isError,
        error: (query.error as Error) ?? null,
        isPending,
        isSyncing,
        createPending: create.isPending,
        updatePending: update.isPending,
        deletePending: remove.isPending,
        ...Object.entries(customMutations).reduce((acc, [key, mutation]) => {
          acc[`${key}Pending`] = mutation.isPending;
          return acc;
        }, {} as Record<string, boolean>),
      },
    } as const;
  };
}

// ---------- Convenience Helpers ----------

export function createStandardController<T extends Entity>(
  queryKey: string[],
  api: EntityAPI<T>,
  store?: OptimisticStore<T>
) {
  const entityStore = store || new OptimisticStore<T>();
  return createEntityController({
    queryKey,
    api,
    store: entityStore,
  });
}

// For read-only entities (no mutations)
export function createReadOnlyController<T extends Entity>(
  queryKey: string[],
  listFn: () => Promise<T[]>,
  store?: OptimisticStore<T>
) {
  const entityStore = store || new OptimisticStore<T>();
  
  return function useReadOnlyController() {
    const query = useQuery({
      queryKey,
      queryFn: listFn,
      staleTime: 5_000,
    });

    useEffect(() => {
      if (query.data) {
        runInAction(() => {
          entityStore.reconcileFromServer(query.data!);
        });
      }
    }, [query.data]);

    return {
      store: entityStore,
      actions: {
        refetch: () => query.refetch(),
      },
      status: {
        isLoading: query.isLoading,
        isError: query.isError,
        error: (query.error as Error) ?? null,
        isSyncing: query.isFetching,
      },
    } as const;
  };
}
