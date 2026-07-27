// Factory for a MobX UI projection backed by TanStack Query.

import {
  hashKey,
  MutationObserver,
  QueryClient,
  QueryObserver,
  type QueryKey,
} from "@tanstack/query-core";
import { observable, runInAction } from "mobx";
import { ObservableUIData } from "./ObservableUIData.js";
import { createRealtimeExtension } from "../realtime/index.js";
import type { RealtimeExtension } from "../realtime/RealtimeExtension.js";
import type { RealtimeSocket } from "../realtime/types.js";
import { createTransformer } from "../transformer/helpers.js";
import { getGlobalQueryClient } from "../query/queryClient.js";
import type {
  DataTransformer,
  Entity,
  OptimisticStore,
  OptimisticStoreConfig,
} from "./types.js";

type MutationKind = "create" | "update" | "delete";

interface CreateMutationContext<TUiData extends Entity> {
  operationSequence: number;
  optimisticItemId?: string;
  previousItem?: TUiData;
  queryKey: QueryKey;
  applied: boolean;
}

interface UpdateLayer<TUpdateInput> {
  operationSequence: number;
  data: TUpdateInput;
}

interface UpdateState<TUiData extends Entity, TUpdateInput> {
  base: TUiData;
  layers: UpdateLayer<TUpdateInput>[];
}

interface UpdateMutationContext {
  operationSequence: number;
  id: string;
  queryKey: QueryKey;
  applied: boolean;
}

interface RemoveMutationContext<TUiData extends Entity> {
  operationSequence: number;
  id: string;
  previousItem?: TUiData;
  queryKey: QueryKey;
  applied: boolean;
}

/**
 * Creates a framework-agnostic optimistic entity store.
 *
 * The TanStack Query cache contains authoritative API entities. MobX contains
 * their UI projection plus temporary optimistic layers. Each mutation owns its
 * own rollback context, so overlapping operations cannot roll back one another.
 */
export function createOptimisticStore<
  TApiData extends Entity,
  TUiData extends Entity = TApiData,
  TStore extends ObservableUIData<TUiData> = ObservableUIData<TUiData>,
  TCreateInput = any,
  TUpdateInput = any,
  TOptimisticContext = any,
>(
  config: OptimisticStoreConfig<
    TApiData,
    TUiData,
    TCreateInput,
    TUpdateInput,
    TOptimisticContext
  >,
  queryClient?: QueryClient,
): OptimisticStore<TApiData, TUiData, TStore, TCreateInput, TUpdateInput> {
  const qc = queryClient ?? getGlobalQueryClient();
  const transformer = createTransformer(config.transformer);

  const uiStore = (
    config.storeClass
      ? new config.storeClass(transformer as DataTransformer<TApiData, TUiData>)
      : new ObservableUIData<TUiData>(transformer)
  ) as TStore;

  const resolveQueryKey = (): QueryKey => {
    if (typeof config.queryKey === "function") {
      return config.queryKey();
    }
    return config.queryKey ?? [config.name];
  };
  const isCurrentQueryScope = (queryKey: QueryKey): boolean =>
    hashKey(queryKey) === hashKey(resolveQueryKey());
  const entitySequenceKey = (queryKey: QueryKey, id: string): string =>
    `${hashKey(queryKey)}:${id}`;

  let manuallyEnabled = true;
  let destroyed = false;
  let operationSequence = 0;

  const isEnabled = (): boolean =>
    manuallyEnabled && (config.enabled ? config.enabled() : true);

  const status = observable({
    isLoading: false,
    isError: false,
    error: null as Error | null,
    isSyncing: false,
    createPendingCount: 0,
    updatePendingCount: 0,
    deletePendingCount: 0,
    get createPending(): boolean {
      return this.createPendingCount > 0;
    },
    get updatePending(): boolean {
      return this.updatePendingCount > 0;
    },
    get deletePending(): boolean {
      return this.deletePendingCount > 0;
    },
    get hasPendingMutations(): boolean {
      return (
        this.createPendingCount +
          this.updatePendingCount +
          this.deletePendingCount >
        0
      );
    },
  });

  const toCleanUiData = (apiData: TApiData): TUiData => {
    const transformed = transformer
      ? transformer.toUi(apiData)
      : (apiData as unknown as TUiData);
    const clean = { ...transformed } as TUiData & Record<string, unknown>;
    delete clean._optimistic;
    delete clean._optimisticTempId;
    delete clean._optimisticOperationSequence;
    return clean;
  };

  const upsertCachedEntity = (queryKey: QueryKey, entity: TApiData): void => {
    qc.setQueryData<TApiData[]>(queryKey, (current) => {
      if (!current) return current;

      const index = current.findIndex((item) => item.id === entity.id);
      if (index === -1) {
        return [...current, entity];
      }

      const next = current.slice();
      next[index] = entity;
      return next;
    });
  };

  const removeCachedEntity = (queryKey: QueryKey, id: string): void => {
    qc.setQueryData<TApiData[]>(queryKey, (current) => {
      if (!current) return current;
      return current.filter((item) => item.id !== id);
    });
  };

  let deferredReconciliation: TApiData[] | undefined;

  const reconcile = (data: TApiData[]): void => {
    if (destroyed) return;
    runInAction(() => {
      uiStore.reconcile(data, transformer);
    });
  };

  const flushDeferredReconciliation = (): void => {
    if (!destroyed && !status.hasPendingMutations && deferredReconciliation) {
      const data = deferredReconciliation;
      deferredReconciliation = undefined;
      reconcile(data);
    }
  };

  const changePendingCount = (kind: MutationKind, delta: 1 | -1): void => {
    runInAction(() => {
      if (kind === "create") {
        status.createPendingCount = Math.max(
          0,
          status.createPendingCount + delta,
        );
      } else if (kind === "update") {
        status.updatePendingCount = Math.max(
          0,
          status.updatePendingCount + delta,
        );
      } else {
        status.deletePendingCount = Math.max(
          0,
          status.deletePendingCount + delta,
        );
      }
    });
  };

  const runMutation = <TResult>(
    kind: MutationKind,
    mutation: () => Promise<TResult>,
  ): Promise<TResult> => {
    if (destroyed) {
      return Promise.reject(
        new Error(`Optimistic store "${config.name}" has been destroyed`),
      );
    }

    changePendingCount(kind, 1);

    let promise: Promise<TResult>;
    try {
      promise = mutation();
    } catch (error) {
      changePendingCount(kind, -1);
      throw error;
    }

    return promise.finally(() => {
      changePendingCount(kind, -1);
      flushDeferredReconciliation();
    });
  };

  const queryObserver = new QueryObserver<TApiData[], Error>(qc, {
    queryKey: resolveQueryKey(),
    queryFn: config.queryFn,
    staleTime: config.staleTime ?? 5 * 60 * 1000,
    enabled: isEnabled(),
  });

  const handleQueryResult = (
    result: ReturnType<typeof queryObserver.getCurrentResult>,
  ): void => {
    runInAction(() => {
      status.isLoading = result.isLoading;
      status.isError = result.isError;
      status.error = result.error;
      status.isSyncing = result.isFetching;
    });

    if (result.data && !result.isFetching) {
      if (status.hasPendingMutations) {
        deferredReconciliation = result.data;
      } else {
        reconcile(result.data);
      }
    }
  };

  let unsubscribeQuery: (() => void) | null = null;

  const ensureQuerySubscription = (): void => {
    if (!unsubscribeQuery && !destroyed) {
      unsubscribeQuery = queryObserver.subscribe(handleQueryResult);
      handleQueryResult(queryObserver.getCurrentResult());
    }
  };

  const syncQuerySubscription = (): void => {
    if (isEnabled()) {
      ensureQuerySubscription();
    } else if (unsubscribeQuery) {
      unsubscribeQuery();
      unsubscribeQuery = null;
    }
  };

  syncQuerySubscription();

  let triggerTimeout: ReturnType<typeof setTimeout> | null = null;

  const triggerQuery = (): void => {
    if (!isEnabled() || destroyed) return;
    ensureQuerySubscription();

    if (triggerTimeout) {
      clearTimeout(triggerTimeout);
    }

    triggerTimeout = setTimeout(() => {
      if (!destroyed && isEnabled()) {
        void queryObserver.refetch();
      }
      triggerTimeout = null;
    }, 10);
  };

  const queryOptions = () => ({
    queryKey: resolveQueryKey(),
    queryFn: config.queryFn,
    staleTime: config.staleTime ?? 5 * 60 * 1000,
    enabled: isEnabled(),
  });

  const optimisticCreateOperations = new Map<string, number>();
  const updateStates = new Map<string, UpdateState<TUiData, TUpdateInput>>();
  const committedEntitySequence = new Map<string, number>();
  const activeDeleteSequence = new Map<string, number>();

  const applyUpdateLayers = (
    base: TUiData,
    layers: UpdateLayer<TUpdateInput>[],
  ): TUiData => {
    let merged = { ...base } as TUiData;

    for (const layer of layers.sort(
      (a, b) => a.operationSequence - b.operationSequence,
    )) {
      if (typeof layer.data === "object" && layer.data !== null) {
        merged = { ...merged, ...layer.data };
      }
    }

    if (!transformer) {
      return merged;
    }

    return transformer.toUi(transformer.toApi(merged));
  };

  const renderUpdateState = (
    id: string,
    state: UpdateState<TUiData, TUpdateInput>,
  ): void => {
    const activeDelete = activeDeleteSequence.get(id);
    const newestLayer =
      state.layers[state.layers.length - 1]?.operationSequence ?? -1;

    if (activeDelete !== undefined && activeDelete > newestLayer) {
      uiStore.remove(id);
      return;
    }

    uiStore.upsert(applyUpdateLayers(state.base, state.layers));
  };

  let realtimeExtension: RealtimeExtension<TApiData, TUiData> | null = null;

  if (config.realtime) {
    realtimeExtension = createRealtimeExtension<TApiData, TUiData>(
      uiStore,
      config.realtime.eventType,
      {
        dataExtractor: config.realtime.dataExtractor,
        shouldProcessEvent: config.realtime.shouldProcessEvent,
        browserId: config.realtime.browserId,
        customHandlers: config.realtime.customHandlers,
        onError: config.realtime.onError,
        onApplied: (operation, data, event) => {
          if (operation === "DELETE") {
            removeCachedEntity(resolveQueryKey(), data.id);
          } else {
            upsertCachedEntity(resolveQueryKey(), data);
          }
          config.realtime?.onApplied?.(operation, data, event);
        },
      },
    );
  }

  const createMutationObserver = new MutationObserver<
    TApiData,
    Error,
    TCreateInput,
    CreateMutationContext<TUiData>
  >(qc, {
    mutationFn: config.mutations.create,
    onMutate: async (data) => {
      const currentOperation = ++operationSequence;
      const queryKey = resolveQueryKey();
      await qc.cancelQueries({ queryKey });

      if (destroyed || !isCurrentQueryScope(queryKey)) {
        return {
          operationSequence: currentOperation,
          queryKey,
          applied: false,
        };
      }

      const tempId = `temp-${Date.now()}-${currentOperation}`;
      const optimisticDefaults =
        transformer?.optimisticDefaults ?? config.optimisticDefaults;

      let candidate: TUiData;
      if (optimisticDefaults?.createOptimisticUiData) {
        candidate = optimisticDefaults.createOptimisticUiData(
          data,
          config.optimisticContext?.(),
        );
      } else if (transformer) {
        candidate = transformer.toUi({
          id: tempId,
          ...(typeof data === "object" && data !== null ? data : {}),
        } as TApiData);
      } else {
        candidate = {
          id: tempId,
          ...(typeof data === "object" && data !== null ? data : {}),
        } as TUiData;
      }

      const optimisticItem = {
        ...candidate,
        _optimistic: true,
        _optimisticTempId: tempId,
        _optimisticOperationSequence: currentOperation,
      } as TUiData;
      const previousItem = uiStore.get(optimisticItem.id);

      optimisticCreateOperations.set(optimisticItem.id, currentOperation);
      runInAction(() => {
        uiStore.upsert(optimisticItem);
      });

      return {
        operationSequence: currentOperation,
        optimisticItemId: optimisticItem.id,
        previousItem,
        queryKey,
        applied: true,
      };
    },
    onSuccess: (result, _variables, context) => {
      const queryKey = context?.queryKey ?? resolveQueryKey();
      upsertCachedEntity(queryKey, result);

      if (destroyed) return;

      if (!isCurrentQueryScope(queryKey)) {
        if (context?.applied && context.optimisticItemId) {
          optimisticCreateOperations.delete(context.optimisticItemId);
        }
        return;
      }

      const uiData = toCleanUiData(result);
      runInAction(() => {
        if (context?.applied && context.optimisticItemId) {
          const current = uiStore.get(context.optimisticItemId) as
            | (TUiData & {
                _optimisticOperationSequence?: number;
              })
            | undefined;

          if (
            optimisticCreateOperations.get(context.optimisticItemId) ===
              context.operationSequence &&
            current?._optimisticOperationSequence === context.operationSequence
          ) {
            uiStore.remove(context.optimisticItemId);
          }
          optimisticCreateOperations.delete(context.optimisticItemId);
        }

        uiStore.upsert(uiData);
      });
    },
    onError: (_error, _variables, context) => {
      if (
        destroyed ||
        !context?.applied ||
        !context.optimisticItemId ||
        !isCurrentQueryScope(context.queryKey)
      ) {
        return;
      }

      const optimisticItemId = context.optimisticItemId;
      runInAction(() => {
        const current = uiStore.get(optimisticItemId) as
          | (TUiData & {
              _optimisticOperationSequence?: number;
            })
          | undefined;

        if (
          optimisticCreateOperations.get(optimisticItemId) ===
            context.operationSequence &&
          current?._optimisticOperationSequence === context.operationSequence
        ) {
          if (context.previousItem) {
            uiStore.upsert(context.previousItem);
          } else {
            uiStore.remove(optimisticItemId);
          }
        }
        optimisticCreateOperations.delete(optimisticItemId);
      });
    },
  });

  const updateMutationObserver = new MutationObserver<
    TApiData,
    Error,
    { id: string; data: TUpdateInput },
    UpdateMutationContext
  >(qc, {
    mutationFn: config.mutations.update,
    onMutate: async ({ id, data }) => {
      const currentOperation = ++operationSequence;
      const queryKey = resolveQueryKey();
      await qc.cancelQueries({ queryKey });

      const existing = uiStore.get(id);
      if (destroyed || !existing || !isCurrentQueryScope(queryKey)) {
        return {
          operationSequence: currentOperation,
          id,
          queryKey,
          applied: false,
        };
      }

      const currentState = updateStates.get(id) ?? {
        base: existing,
        layers: [],
      };
      const nextState = {
        base: currentState.base,
        layers: [
          ...currentState.layers,
          { operationSequence: currentOperation, data },
        ],
      };
      const rendered = applyUpdateLayers(nextState.base, nextState.layers);

      updateStates.set(id, nextState);
      runInAction(() => {
        uiStore.upsert(rendered);
      });

      return {
        operationSequence: currentOperation,
        id,
        queryKey,
        applied: true,
      };
    },
    onSuccess: (result, _variables, context) => {
      const id = context?.id ?? result.id;
      const currentOperation =
        context?.operationSequence ?? ++operationSequence;
      const queryKey = context?.queryKey ?? resolveQueryKey();
      const sequenceKey = entitySequenceKey(queryKey, id);
      const latestCommitted = committedEntitySequence.get(sequenceKey) ?? -1;

      if (currentOperation <= latestCommitted) {
        return;
      }

      committedEntitySequence.set(sequenceKey, currentOperation);
      upsertCachedEntity(queryKey, result);

      if (destroyed || !isCurrentQueryScope(queryKey)) return;

      const serverUiData = toCleanUiData(result);
      const currentState = updateStates.get(id);
      const nextState = currentState
        ? {
            base: serverUiData,
            layers: currentState.layers.filter(
              (layer) => layer.operationSequence > currentOperation,
            ),
          }
        : {
            base: serverUiData,
            layers: [],
          };

      const laterDelete =
        (activeDeleteSequence.get(id) ?? -1) > currentOperation;

      if (nextState.layers.length > 0 || laterDelete) {
        updateStates.set(id, nextState);
      } else {
        updateStates.delete(id);
      }

      runInAction(() => {
        renderUpdateState(id, nextState);
      });
    },
    onError: (_error, _variables, context) => {
      if (
        destroyed ||
        !context?.applied ||
        !isCurrentQueryScope(context.queryKey)
      ) {
        return;
      }

      const latestCommitted =
        committedEntitySequence.get(
          entitySequenceKey(context.queryKey, context.id),
        ) ?? -1;
      if (context.operationSequence <= latestCommitted) return;

      const currentState = updateStates.get(context.id);
      if (!currentState) return;

      const nextState = {
        base: currentState.base,
        layers: currentState.layers.filter(
          (layer) => layer.operationSequence !== context.operationSequence,
        ),
      };
      const laterDelete =
        (activeDeleteSequence.get(context.id) ?? -1) >
        context.operationSequence;

      if (nextState.layers.length > 0 || laterDelete) {
        updateStates.set(context.id, nextState);
      } else {
        updateStates.delete(context.id);
      }

      runInAction(() => {
        renderUpdateState(context.id, nextState);
      });
    },
  });

  const removeMutationObserver = new MutationObserver<
    { id: string } | void,
    Error,
    string,
    RemoveMutationContext<TUiData>
  >(qc, {
    mutationFn: config.mutations.remove,
    onMutate: async (id) => {
      const currentOperation = ++operationSequence;
      const queryKey = resolveQueryKey();
      await qc.cancelQueries({ queryKey });

      const previousItem = uiStore.get(id);
      if (destroyed || !isCurrentQueryScope(queryKey)) {
        return {
          operationSequence: currentOperation,
          id,
          queryKey,
          applied: false,
        };
      }

      activeDeleteSequence.set(id, currentOperation);
      runInAction(() => {
        uiStore.remove(id);
      });

      return {
        operationSequence: currentOperation,
        id,
        previousItem,
        queryKey,
        applied: true,
      };
    },
    onSuccess: (_result, id, context) => {
      const currentOperation =
        context?.operationSequence ?? ++operationSequence;
      const queryKey = context?.queryKey ?? resolveQueryKey();
      const sequenceKey = entitySequenceKey(queryKey, id);
      const latestCommitted = committedEntitySequence.get(sequenceKey) ?? -1;

      if (currentOperation <= latestCommitted) return;

      committedEntitySequence.set(sequenceKey, currentOperation);
      removeCachedEntity(queryKey, id);

      if (destroyed || !isCurrentQueryScope(queryKey)) return;

      const currentState = updateStates.get(id);
      if (currentState) {
        const laterLayers = currentState.layers.filter(
          (layer) => layer.operationSequence > currentOperation,
        );
        if (laterLayers.length > 0) {
          updateStates.set(id, {
            base: currentState.base,
            layers: laterLayers,
          });
        } else {
          updateStates.delete(id);
        }
      }

      if (activeDeleteSequence.get(id) === currentOperation) {
        activeDeleteSequence.delete(id);
      }

      runInAction(() => {
        uiStore.remove(id);
      });
    },
    onError: (_error, id, context) => {
      if (
        destroyed ||
        !context?.applied ||
        !isCurrentQueryScope(context.queryKey)
      ) {
        return;
      }

      if (activeDeleteSequence.get(id) === context.operationSequence) {
        activeDeleteSequence.delete(id);
      }

      if (
        context.operationSequence <=
        (committedEntitySequence.get(entitySequenceKey(context.queryKey, id)) ??
          -1)
      ) {
        return;
      }

      runInAction(() => {
        const currentState = updateStates.get(id);
        if (currentState) {
          renderUpdateState(id, currentState);
          if (currentState.layers.length === 0) {
            updateStates.delete(id);
          }
        } else if (context.previousItem) {
          uiStore.upsert(context.previousItem);
        }
      });
    },
  });

  const syncProjectionScope = (): void => {
    const nextQueryKey = resolveQueryKey();
    if (hashKey(queryObserver.options.queryKey) === hashKey(nextQueryKey)) {
      return;
    }

    deferredReconciliation = undefined;
    optimisticCreateOperations.clear();
    updateStates.clear();
    activeDeleteSequence.clear();
    runInAction(() => {
      uiStore.clear();
    });
  };

  const optimisticStore: OptimisticStore<
    TApiData,
    TUiData,
    TStore,
    TCreateInput,
    TUpdateInput
  > = {
    ui: uiStore,
    api: {
      create: (data) =>
        runMutation("create", () => createMutationObserver.mutate(data)),
      update: (id, data) =>
        runMutation("update", () =>
          updateMutationObserver.mutate({ id, data }),
        ),
      remove: (id) =>
        runMutation("delete", () => removeMutationObserver.mutate(id)),
      refetch: async () => {
        const wasSubscribed = unsubscribeQuery !== null;
        ensureQuerySubscription();
        try {
          return await queryObserver.refetch();
        } finally {
          if (!wasSubscribed) {
            syncQuerySubscription();
          }
        }
      },
      invalidate: () => qc.invalidateQueries({ queryKey: resolveQueryKey() }),
      triggerQuery,
      status,
    },
    updateOptions: () => {
      syncProjectionScope();
      queryObserver.setOptions(queryOptions());
      syncQuerySubscription();
    },
    isEnabled,
    enable: () => {
      manuallyEnabled = true;
      syncProjectionScope();
      queryObserver.setOptions(queryOptions());
      syncQuerySubscription();
    },
    disable: () => {
      manuallyEnabled = false;
      syncProjectionScope();
      queryObserver.setOptions(queryOptions());
      syncQuerySubscription();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;

      if (triggerTimeout) {
        clearTimeout(triggerTimeout);
        triggerTimeout = null;
      }

      realtimeExtension?.disconnect();
      unsubscribeQuery?.();
      unsubscribeQuery = null;
      createMutationObserver.reset();
      updateMutationObserver.reset();
      removeMutationObserver.reset();
      deferredReconciliation = undefined;
      optimisticCreateOperations.clear();
      updateStates.clear();
      committedEntitySequence.clear();
      activeDeleteSequence.clear();
    },
    ...(realtimeExtension && {
      realtime: {
        get isConnected() {
          return realtimeExtension.connected;
        },
        connect: (socket: RealtimeSocket) => {
          realtimeExtension.connect(socket);
        },
        disconnect: () => {
          realtimeExtension.disconnect();
        },
      },
    }),
  };

  return optimisticStore;
}
