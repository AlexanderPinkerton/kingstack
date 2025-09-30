// TanStack Query Client singleton

import { QueryClient } from "@tanstack/query-core";

// Global query client singleton to avoid creating multiple instances
let globalQueryClient: QueryClient | null = null;

export function getGlobalQueryClient(): QueryClient {
  if (!globalQueryClient) {
    globalQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Optimize default settings for better performance
          staleTime: 5 * 60 * 1000, // 5 minutes
          gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
          retry: 1, // Reduce retries for better UX
          refetchOnWindowFocus: false, // Disable to reduce unnecessary requests
          refetchOnReconnect: true,
        },
        mutations: {
          retry: 1,
        },
      },
    });
  }
  return globalQueryClient;
}
