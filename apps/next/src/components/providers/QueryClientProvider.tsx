"use client";

import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootStoreContext } from "@/context/rootStoreContext";
import { RootStore } from "@/stores/rootStore";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 5 * 60 * 1000,
      },
      mutations: {
        retry: 1,
      },
    },
  });
}

interface Props {
  children: React.ReactNode;
}

export function AppProviders({ children }: Props) {
  const [queryClient] = useState(createQueryClient);
  const [rootStore] = useState(() => new RootStore({ queryClient }));

  useEffect(() => rootStore.mount(), [rootStore]);

  return (
    <QueryClientProvider client={queryClient}>
      <RootStoreContext.Provider value={rootStore}>
        {children}
      </RootStoreContext.Provider>
    </QueryClientProvider>
  );
}
