"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootStoreContext } from "@/context/rootStoreContext";
import { RootStore } from "@/stores/rootStore";

// Create a client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

// Create root store instance
const rootStore = new RootStore();

interface Props {
  children: React.ReactNode;
}

export function AppProviders({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <RootStoreContext.Provider value={rootStore}>
        {children}
      </RootStoreContext.Provider>
    </QueryClientProvider>
  );
}
