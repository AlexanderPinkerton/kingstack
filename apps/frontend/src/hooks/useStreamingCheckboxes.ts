"use client";

import { useEffect, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";
import { useQuery } from "@tanstack/react-query";
import { useRootStore } from "./useRootStore";
import { useStreamingCheckboxOptimisticStore, createStreamingCheckboxQuery } from "@/stores/streamingCheckboxStore";
import { CheckboxUiData } from "@/stores/types/checkbox";

interface StreamingConfig {
  totalItems: number;
  chunkSize: number;
}

export const useStreamingCheckboxes = (config: StreamingConfig) => {
  const rootStore = useRootStore();
  const optimisticStore = useStreamingCheckboxOptimisticStore();
  
  // Use streaming query
  const streamingQuery = useQuery(createStreamingCheckboxQuery(config.totalItems, config.chunkSize));
  
  // Process streamed data into the optimistic store
  useEffect(() => {
    if (streamingQuery.data && streamingQuery.data.length > 0) {
      console.log(`Processing ${streamingQuery.data.length} streamed checkboxes`);
      
      // Transform API data to UI data
      const uiData = streamingQuery.data.map((apiData: any) => ({
        id: apiData.id,
        index: apiData.index,
        checked: apiData.checked,
        created_at: new Date(apiData.created_at),
        updated_at: new Date(apiData.updated_at),
      }));
      
      // Add to optimistic store
      runInAction(() => {
        uiData.forEach((checkbox: CheckboxUiData) => {
          optimisticStore.store.upsert(checkbox);
        });
      });
      
      console.log(`Added ${uiData.length} checkboxes to store. Total: ${optimisticStore.store.count}`);
    }
  }, [streamingQuery.data, optimisticStore.store]);

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
  const handleCheckboxChange = useCallback((index: number, checked: boolean) => {
    // Check if checkbox already exists
    const existingCheckbox = optimisticStore.store.list.find(cb => cb.index === index);
    
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
  }, [optimisticStore.actions, optimisticStore.store.list]);

  // Get checkbox by index
  const getCheckbox = useCallback((index: number) => {
    return optimisticStore.store.list.find(checkbox => checkbox.index === index);
  }, [optimisticStore.store.list]);

  return {
    // Store data
    checkboxes: optimisticStore.store.list,
    count: optimisticStore.store.count,
    totalItems: config.totalItems,
    
    // Streaming status
    isStreaming: streamingQuery.isFetching,
    streamProgress: streamingQuery.data ? 
      Math.min(100, (streamingQuery.data.length / config.totalItems) * 100) : 0,
    isStreamComplete: streamingQuery.isSuccess && !streamingQuery.isFetching,
    
    // Actions
    handleCheckboxChange,
    getCheckbox,
    refetch: streamingQuery.refetch,
    
    // Status
    isLoading: streamingQuery.isLoading,
    isError: streamingQuery.isError,
    error: streamingQuery.error,
  };
};
