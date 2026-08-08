"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryPostRepository } from "@/repositories/posts/memory-post-repository";
import type { PostRepositoryContext } from "@/repositories/posts/types";
import { AdvancedPostStore } from "@/stores/userApp/postStore";
import { OptimisticPostDemoController } from "@/stores/userApp/optimisticPostDemoController";
import { AdvancedPostsExampleView } from "./advanced-posts-view";
import { createOptimisticPostFixtures } from "./optimistic-post-fixtures";

const demoContext: PostRepositoryContext = {
  scope: "optimistic-demo",
  enabled: true,
  currentUser: {
    id: "demo-user",
    email: "demo@local.test",
    user_metadata: { username: "Demo User" },
  },
};

function createDemoRuntime() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: false },
      mutations: { retry: 1 },
    },
  });
  const source = createMemoryPostRepository({
    seed: createOptimisticPostFixtures(),
  });
  const controller = new OptimisticPostDemoController(source);
  const store = new AdvancedPostStore(
    queryClient,
    controller.repository,
    demoContext,
  );
  controller.attachStore(store);
  return { controller, queryClient, store };
}

export function AdvancedPostsExample() {
  const [runtime] = useState(createDemoRuntime);
  const lifecycleGeneration = useRef(0);

  useEffect(() => {
    lifecycleGeneration.current += 1;

    return () => {
      const cleanupGeneration = ++lifecycleGeneration.current;
      queueMicrotask(() => {
        if (lifecycleGeneration.current !== cleanupGeneration) return;
        runtime.controller.dispose();
        runtime.store.dispose();
        runtime.queryClient.clear();
      });
    };
  }, [runtime]);

  return (
    <QueryClientProvider client={runtime.queryClient}>
      <AdvancedPostsExampleView
        postStore={runtime.store}
        demoController={runtime.controller}
        currentUserId={demoContext.currentUser?.id ?? "demo-user"}
      />
    </QueryClientProvider>
  );
}
