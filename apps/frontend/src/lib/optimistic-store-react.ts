// React utilities for the framework-agnostic optimistic store pattern
// This file provides React-specific hooks and utilities

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createOptimisticStoreManager,
  OptimisticStoreConfig,
  OptimisticStoreManager,
  OptimisticStore,
  Entity,
} from "./optimistic-store-pattern";

/**
 * React hook that creates and manages an optimistic store using TanStack Query React.
 * This provides the same API as the old createOptimisticStore but uses the new
 * framework-agnostic core underneath.
 *
 * @param config - The store configuration
 * @returns A hook function that returns the store manager with typed store
 */
export function createOptimisticStore<
  TApiData extends Entity,
  TUiData extends Entity = TApiData,
  TStore extends OptimisticStore<TUiData> = OptimisticStore<TUiData>,
>(config: OptimisticStoreConfig<TApiData, TUiData>) {
  // Return a React hook that manages the store instance
  return function useOptimisticStore(): {
    store: TStore;
    actions: OptimisticStoreManager<TApiData, TUiData, TStore>["actions"];
    status: OptimisticStoreManager<TApiData, TUiData, TStore>["status"];
  } {
    // Get the React Query client from context
    const queryClient = useQueryClient();

    // Create manager instance once using useRef to keep it stable across renders
    const managerRef = useRef<OptimisticStoreManager<
      TApiData,
      TUiData,
      TStore
    > | null>(null);

    if (!managerRef.current) {
      managerRef.current = createOptimisticStoreManager<
        TApiData,
        TUiData,
        TStore
      >(config, queryClient);
    }

    // Update options on each render to handle dynamic values like auth tokens
    useEffect(() => {
      if (managerRef.current) {
        managerRef.current.updateOptions();
      }
    });

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (managerRef.current) {
          managerRef.current.destroy();
        }
      };
    }, []);

    return {
      store: managerRef.current.store,
      actions: managerRef.current.actions,
      status: managerRef.current.status,
    };
  };
}

// Re-export everything from the core pattern for convenience
export * from "./optimistic-store-pattern";
