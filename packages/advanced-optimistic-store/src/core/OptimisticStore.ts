// Factory function to create optimistic stores with TanStack Query integration
// Provides a clean API with ui (MobX) and api (TanStack Query) namespaces

import {
  QueryClient,
  MutationObserver,
  QueryObserver,
  notifyManager,
} from "@tanstack/query-core";
import { observable, runInAction } from "mobx";
import { ObservableUIData } from "./ObservableUIData";
import { createRealtimeExtension } from "../realtime";
import type { RealtimeExtension } from "../realtime/RealtimeExtension";
import { createTransformer } from "../transformer/helpers";
import { getGlobalQueryClient } from "../query/queryClient";
import type { Entity, OptimisticStoreConfig, OptimisticStore } from "./types";

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
export function createOptimisticStore<
  TApiData extends Entity,
  TUiData extends Entity = TApiData,
  TStore extends ObservableUIData<TUiData> = ObservableUIData<TUiData>,
>(
  config: OptimisticStoreConfig<TApiData, TUiData>,
  queryClient?: QueryClient,
): OptimisticStore<TApiData, TUiData, TStore> {
  // Store managers are NOT cached - they're cheap to create (~5-10ms)
  // TanStack Query caches query RESULTS by queryKey (config.name)
  // That's where the real performance gain is (avoiding 100-500ms network requests)

  // Use provided query client or get the global singleton
  const qc = queryClient || getGlobalQueryClient();

  // Track enabled state first
  let enabledState = config.enabled ? config.enabled() : true;

  // Create transformer
  const transformer = createTransformer(config.transformer);

  // Create UI data store instance
  const StoreClass = (config.storeClass as any) || ObservableUIData<TUiData>;
  const uiStore = new StoreClass(transformer) as TStore;

  // Create realtime extension if config provided (but don't connect yet)
  let realtimeExtension: RealtimeExtension<TUiData> | null = null;
  if (config.realtime) {
    realtimeExtension = createRealtimeExtension<TUiData>(
      uiStore,
      config.realtime.eventType,
      {
        dataExtractor: config.realtime.dataExtractor,
        shouldProcessEvent: config.realtime.shouldProcessEvent,
        browserId: config.realtime.browserId,
        customHandlers: config.realtime.customHandlers,
      },
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
    enabled: enabledState,
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
      console.log(`⏸️ Skipping reconciliation while mutations are pending`);
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
          uiStore.reconcile(result.data!, transformer);
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
    // Always check the current config function if it exists
    return config.enabled ? config.enabled() : enabledState;
  };

  // Initial trigger only if enabled
  if (enabledState) {
    triggerQuery();
  }

  // Create mutation observers with optimized batching
  const createMutationObserver = new MutationObserver(qc, {
    mutationFn: config.mutations.create,
    onMutate: async (data: any) => {
      console.log("TESTLOG-onMutate:");
      await qc.cancelQueries({ queryKey: [config.name] });
      uiStore.pushSnapshot();

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

      // Mark as optimistic for proper cleanup during reconciliation
      (optimisticItem as any)._optimistic = true;
      (optimisticItem as any)._optimisticTempId = tempId;

      // Batch the optimistic update
      notifyManager.batch(() => {
        runInAction(() => {
          uiStore.upsert(optimisticItem);
        });
      });

      return { tempId, optimisticItemId: optimisticItem.id };
    },
    onSuccess: (result: TApiData, variables: any, context: any) => {
      console.log("onSuccess:");
      // Batch the success update
      notifyManager.batch(() => {
        runInAction(() => {
          // Remove optimistic item(s) - find by _optimistic flag or tempId
          // This handles cases where the optimistic ID doesn't match tempId
          const optimisticItems = uiStore.list.filter(
            (item: any) =>
              item._optimistic === true ||
              item.id === context.tempId ||
              item.id === context.optimisticItemId,
          );

          optimisticItems.forEach((item) => {
            uiStore.remove(item.id);
          });

          // Add real item from server
          if (transformer) {
            const uiData = transformer.toUi(result);
            // Ensure _optimistic flag is removed from server data
            delete (uiData as any)._optimistic;
            delete (uiData as any)._optimisticTempId;
            uiStore.upsert(uiData);
          } else {
            const uiData = result as unknown as TUiData;
            delete (uiData as any)._optimistic;
            delete (uiData as any)._optimisticTempId;
            uiStore.upsert(uiData);
          }
        });
      });
    },
    onError: () => {
      // Batch the error rollback
      notifyManager.batch(() => {
        runInAction(() => {
          uiStore.rollback();
        });
      });
    },
  });

  const updateMutationObserver = new MutationObserver(qc, {
    mutationFn: config.mutations.update,
    onMutate: async ({ id, data }: { id: string; data: any }) => {
      await qc.cancelQueries({ queryKey: [config.name] });
      uiStore.pushSnapshot();

      // Optimistic update with proper UI data calculation
      notifyManager.batch(() => {
        runInAction(() => {
          // Get existing item to merge with updates
          const existingItem = uiStore.get(id);
          if (existingItem) {
            // Merge the existing item with the updates
            const mergedData = { ...existingItem, ...data };

            // Use transformer to recalculate computed fields if available
            if (transformer) {
              // For updates, convert to API data and back to UI data to recalculate computed fields
              const apiData = transformer.toApi(mergedData);
              const uiData = transformer.toUi(apiData);
              uiStore.upsert(uiData);
            } else {
              // No transformer - just merge as before
              uiStore.upsert(mergedData);
            }
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
            uiStore.upsert(uiData);
          } else {
            uiStore.upsert(result as unknown as TUiData);
          }
        });
      });
    },
    onError: () => {
      notifyManager.batch(() => {
        runInAction(() => {
          uiStore.rollback();
        });
      });
    },
  });

  const removeMutationObserver = new MutationObserver(qc, {
    mutationFn: config.mutations.remove,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: [config.name] });
      uiStore.pushSnapshot();

      // Optimistic update
      notifyManager.batch(() => {
        runInAction(() => {
          uiStore.remove(id);
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
          uiStore.rollback();
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

  const optimisticStore = {
    // UI domain - observable MobX state
    ui: uiStore,

    // API domain - TanStack Query + mutations
    api: {
      // Optimistic mutations
      create: (data: any) => createMutationObserver.mutate(data),
      update: (id: string, data: any) =>
        updateMutationObserver.mutate({ id, data }),
      remove: (id: string) => removeMutationObserver.mutate(id),

      // Query control
      refetch: () => queryObserver.refetch(),
      invalidate: () => qc.invalidateQueries({ queryKey: [config.name] }),
      triggerQuery: () => triggerQuery(),

      // Query state
      status,
    },

    // Lifecycle methods
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
      enabledState = true;
      queryObserver.setOptions({
        queryKey: [config.name],
        queryFn: config.queryFn,
        staleTime: config.staleTime ?? 5 * 60 * 1000,
        enabled: true,
      });
      triggerQuery();
    },
    disable: () => {
      enabledState = false;
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

  return optimisticStore;
}
