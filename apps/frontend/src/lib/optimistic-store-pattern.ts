// Generic Optimistic Store Pattern with Data Transformations
// A reusable framework for MobX + TanStack Query with optimistic updates and API/UI data transformation

import { makeAutoObservable, runInAction } from "mobx";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Note: Import TanStack Query types based on your installation
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ---------- Core Types ----------

export interface Entity {
  id: string;
}

// Separate API and UI data types
export interface EntityAPI<TApiData extends Entity, TCreate = Omit<TApiData, "id">, TUpdate = Partial<TApiData>> {
  list(): Promise<TApiData[]>;
  create(data: TCreate): Promise<TApiData>;
  update(id: string, data: TUpdate): Promise<TApiData>;
  delete(id: string): Promise<{ id: string }>;
}

// Transformation interface
export interface DataTransformer<TApiData extends Entity, TUiData extends Entity> {
  toUi(apiData: TApiData): TUiData;
  toApi(uiData: TUiData): TApiData;
  // For partial updates - transform only the changed fields
  toApiUpdate(uiData: Partial<TUiData>): Partial<TApiData>;
}

export interface OptimisticAction<TParams = any, TResult = any, TStore = OptimisticStore<any>> {
  mutationFn: (params: TParams) => Promise<TResult>;
  onOptimistic?: (params: TParams, store: TStore) => void;
  onSuccess?: (result: TResult, params: TParams, store: TStore) => void;
  onError?: (error: Error, params: TParams, store: TStore) => void;
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

  // Transform and store server data
  replaceAllFromApi<TApiData extends Entity>(
    apiList: TApiData[], 
    transformer: DataTransformer<TApiData, T>
  ) {
    const uiList = apiList.map(transformer.toUi);
    this.replaceAll(uiList);
  }

  reconcileFromApiServer<TApiData extends Entity>(
    apiList: TApiData[], 
    transformer: DataTransformer<TApiData, T>
  ) {
    const uiList = apiList.map(transformer.toUi);
    this.reconcileFromServer(uiList);
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

// ---------- Controller Factory (Template) ----------

export interface ControllerConfig<TApiData extends Entity, TUiData extends Entity, TCreate, TUpdate, TStore extends OptimisticStore<TUiData> = OptimisticStore<TUiData>> {
  queryKey: string[];
  api: EntityAPI<TApiData, TCreate, TUpdate>;
  store: TStore;
  transformer?: DataTransformer<TApiData, TUiData>;
  staleTime?: number;
  customActions?: Record<string, OptimisticAction<any, any, TStore>>;
  enabled?: boolean; // Allow disabling the query
}


export function createEntityController<
  TApiData extends Entity,
  TUiData extends Entity = TApiData,
  TCreate = Omit<TApiData, "id">,
  TUpdate = Partial<TApiData>,
  TStore extends OptimisticStore<TUiData> = OptimisticStore<TUiData>
>(config: ControllerConfig<TApiData, TUiData, TCreate, TUpdate, TStore>) {
   return function useEntityController() {
     const qc = useQueryClient();
     const { queryKey, api, store, transformer, staleTime = 5_000, customActions = {}, enabled = true } = config;

     // 1) Hydrate store from server
     const query = useQuery({
       queryKey,
       queryFn: api.list,
       staleTime,
       enabled, // Disable query if enabled is false
     });
 
     useEffect(() => {
       if (query.data) {
         runInAction(() => {
           if (transformer) {
             store.reconcileFromApiServer(query.data!, transformer);
           } else {
             store.reconcileFromServer(query.data! as unknown as TUiData[]);
           }
         });
       }
     }, [query.data]);
 
     // 2) Standard mutations with transformation support
     const create = useMutation({
       mutationFn: api.create,
       onMutate: async (data: TCreate) => {
         await qc.cancelQueries({ queryKey });
         store.pushSnapshot();
         
         const tempId = `temp_${Math.random().toString(36).slice(2, 7)}`;
         let optimisticEntity: TUiData;
         
         if (transformer) {
           const apiData = { id: tempId, ...data } as unknown as TApiData;
           optimisticEntity = transformer.toUi(apiData);
         } else {
           optimisticEntity = { id: tempId, ...data } as unknown as TUiData;
         }
         
         store.upsert(optimisticEntity);
         return { tempId };
       },
       onError: () => store.rollback(),
       onSuccess: (result: TApiData, _vars: TCreate, ctx: any) => {
         if (ctx?.tempId) store.remove(ctx.tempId);
         const uiResult = transformer ? transformer.toUi(result) : (result as unknown as TUiData);
         store.upsert(uiResult);
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
          
          // Transform update data if needed
          if (transformer) {
            // This is tricky - we need to convert UI partial updates to API partial updates
            // For now, we'll do a simple cast, but this could be enhanced
            const uiUpdates = data as unknown as Partial<TUiData>;
            store.update(id, uiUpdates);
          } else {
            store.update(id, data as unknown as Partial<TUiData>);
          }
          
          return { id, data };
        },
        onError: () => store.rollback(),
        onSuccess: (result: TApiData) => {
          const uiResult = transformer ? transformer.toUi(result) : (result as unknown as TUiData);
          store.upsert(uiResult);
        },
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
      const customMutations = Object.entries(customActions || {}).reduce((acc, [key, action]) => {
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

      // Build custom action functions with proper typing
      const customActionFunctions = Object.entries(customMutations).reduce((acc, [key, mutation]) => {
        acc[key] = (params: any) => mutation.mutate(params);
        return acc;
      }, {} as Record<string, (params: any) => void>);

      const customStatusFlags = Object.entries(customMutations).reduce((acc, [key, mutation]) => {
        acc[`${key}Pending`] = mutation.isPending;
        return acc;
      }, {} as Record<string, boolean>);

      return {
        store,
        actions: {
          create: (data: TCreate) => create.mutate(data),
          update: (id: string, data: TUpdate) => update.mutate({ id, data }),
          remove: (id: string) => remove.mutate(id),
          refetch: () => query.refetch(),
          ...customActionFunctions,
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
          ...customStatusFlags,
        },
      };
   };
 }
 

// ---------- Simple API for Common Use Cases ----------

/**
 * Simple configuration for the most common use case
 */
export interface SimpleOptimisticConfig<TApiData extends Entity, TUiData extends Entity = TApiData> {
  /** Unique identifier for this data type (used for query keys) */
  name: string;
  /** Your API implementation */
  api: EntityAPI<TApiData>;
  /** Optional: Custom transformer (auto-detected if not provided) */
  transformer?: DataTransformer<TApiData, TUiData>;
  /** Optional: Custom store class (creates basic OptimisticStore if not provided) */
  storeClass?: new () => OptimisticStore<TUiData>;
  /** Optional: Cache time in milliseconds (default: 5 minutes) */
  staleTime?: number;
}

/**
 * Creates a fully configured optimistic store with minimal setup.
 * 
 * For simple cases where API data === UI data:
 * ```ts
 * const useTodos = createOptimisticStore({
 *   name: 'todos',
 *   api: todoAPI
 * });
 * ```
 * 
 * For cases with data transformation:
 * ```ts
 * const useTodos = createOptimisticStore<TodoApiData, TodoUiData>({
 *   name: 'todos', 
 *   api: todoAPI,
 *   transformer: todoTransformer
 * });
 * ```
 */
export function createOptimisticStore<
  TApiData extends Entity,
  TUiData extends Entity = TApiData,
  TStore extends OptimisticStore<TUiData> = OptimisticStore<TUiData>
>(config: SimpleOptimisticConfig<TApiData, TUiData>) {
  // Create store instance
  const StoreClass = config.storeClass as any || OptimisticStore<TUiData>;
  const store = new StoreClass() as TStore;
  
  // Create the controller
  const controller = createEntityController<TApiData, TUiData, Omit<TApiData, 'id'>, Partial<TApiData>, TStore>({
    queryKey: [config.name],
    api: config.api,
    store,
    transformer: config.transformer,
    staleTime: config.staleTime ?? 5 * 60 * 1000, // 5 minutes default
  });

  return controller;
}

// ---------- Advanced API for Power Users ----------

/**
 * Advanced configuration with full control over custom actions, queries, etc.
 */
export interface AdvancedOptimisticConfig<
  TApiData extends Entity, 
  TUiData extends Entity, 
  TStore extends OptimisticStore<TUiData>
> extends SimpleOptimisticConfig<TApiData, TUiData> {
  /** Custom actions beyond basic CRUD */
  customActions?: Record<string, OptimisticAction<any, any, TStore>>;
  /** Custom store instance (overrides storeClass) */
  store?: TStore;
}

/**
 * Advanced version with full customization options
 */
export function createAdvancedOptimisticStore<
  TApiData extends Entity,
  TUiData extends Entity = TApiData,
  TStore extends OptimisticStore<TUiData> = OptimisticStore<TUiData>
>(config: AdvancedOptimisticConfig<TApiData, TUiData, TStore>) {
  // Use provided store or create from class or default
  const store = config.store || 
    (config.storeClass ? new (config.storeClass as any)() : new OptimisticStore<TUiData>()) as TStore;
  
  return createEntityController<TApiData, TUiData, Omit<TApiData, 'id'>, Partial<TApiData>, TStore>({
    queryKey: [config.name],
    api: config.api,
    store,
    transformer: config.transformer,
    staleTime: config.staleTime ?? 5 * 60 * 1000,
    customActions: config.customActions,
  });
}

// ---------- Legacy Convenience Helpers ----------

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

// Identity transformer (no transformation)
export function identityTransformer<T extends Entity>(): DataTransformer<T, T> {
  return {
    toUi: (data: T) => data,
    toApi: (data: T) => data,
    toApiUpdate: (data: Partial<T>) => data,
  };
}
