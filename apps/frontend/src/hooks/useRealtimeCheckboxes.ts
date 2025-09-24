"use client";

import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";
import { useRootStore } from "./useRootStore";
import { useCheckboxOptimisticStore } from "@/stores/checkboxOptimisticStore";

/**
 * Unified hook that combines optimistic updates with realtime sync
 * - Uses optimistic store for immediate UI updates and API calls
 * - Uses realtime store for receiving updates from other users
 * - Automatically syncs realtime updates to the optimistic store
 */
export const useRealtimeCheckboxes = () => {
  const rootStore = useRootStore();
  const optimisticStore = useCheckboxOptimisticStore();


  // Sync realtime updates to optimistic store
  useEffect(() => {
    const handleRealtimeUpdate = (data: any) => {
      console.log("Realtime checkbox update received:", data);
      
      if (data.type === "checkbox_update") {
        const { event, checkbox } = data;
        
        if (event === "INSERT" || event === "UPDATE") {
          // Convert API data to UI data and update optimistic store
          const uiCheckbox = {
            id: checkbox.id,
            index: checkbox.index,
            checked: checkbox.checked,
            created_at: new Date(checkbox.created_at),
            updated_at: new Date(checkbox.updated_at),
          };
          
          // Update the optimistic store with the realtime data using MobX action
          runInAction(() => {
            optimisticStore.store.upsert(uiCheckbox);
          });
          console.log("Updated optimistic store with realtime data:", uiCheckbox);
        } else if (event === "DELETE") {
          // Remove from optimistic store
          const checkboxToRemove = optimisticStore.store.list.find(cb => cb.index === checkbox.index);
          if (checkboxToRemove) {
            runInAction(() => {
              optimisticStore.store.remove(checkboxToRemove.id);
            });
            console.log("Removed checkbox from optimistic store:", checkbox.index);
          }
        }
      }
    };

    // Listen for realtime updates on the socket
    if (rootStore.socket) {
      console.log("Setting up realtime checkbox listener");
      rootStore.socket.on("checkbox_update", handleRealtimeUpdate);
      
      return () => {
        console.log("Cleaning up realtime checkbox listener");
        rootStore.socket?.off("checkbox_update", handleRealtimeUpdate);
      };
    } else {
      console.log("No socket available for realtime updates");
    }
  }, [rootStore.socket, optimisticStore.store]);

  // Handle checkbox changes with optimistic updates
  const handleCheckboxChange = (index: number, checked: boolean) => {
    // Check if checkbox already exists
    const existingCheckbox = getCheckbox(index);
    
    if (existingCheckbox) {
      // Update existing checkbox
      optimisticStore.actions.update({ 
        id: existingCheckbox.id, 
        data: { index, checked } 
      });
    } else {
      // Create new checkbox
      optimisticStore.actions.create({ index, checked });
    }
  };

  // Get checkbox by index
  const getCheckbox = (index: number) => {
    return optimisticStore.store.list.find(checkbox => checkbox.index === index);
  };

  return {
    // Store data
    checkboxes: optimisticStore.store.list,
    count: optimisticStore.store.count,
    
    // Actions
    handleCheckboxChange,
    getCheckbox,
    refetch: optimisticStore.actions.refetch,
    
    // Status
    isLoading: optimisticStore.status.isLoading,
    isError: optimisticStore.status.isError,
    error: optimisticStore.status.error,
    isSyncing: optimisticStore.status.isSyncing,
    updatePending: optimisticStore.status.updatePending,
  };
};
