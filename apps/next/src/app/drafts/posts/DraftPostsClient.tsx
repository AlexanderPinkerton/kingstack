"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdvancedPostsExampleView } from "@/lib/examples/advanced-posts-view";
import { createMemoryPostRepository } from "@/repositories/posts/memory-post-repository";
import type { PostRepositoryContext } from "@/repositories/posts/types";
import { AdvancedPostStore } from "@/stores/userApp/postStore";
import { createDraftPostFixtures } from "./fixtures";

const draftContext: PostRepositoryContext = {
  scope: "draft-posts",
  enabled: true,
  currentUser: {
    id: "draft-designer",
    email: "designer@local.test",
    user_metadata: {
      username: "Draft Designer",
    },
  },
};

function createDraftRuntime() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  const repository = createMemoryPostRepository({
    seed: createDraftPostFixtures(),
  });

  return {
    queryClient,
    store: new AdvancedPostStore(queryClient, repository, draftContext),
  };
}

export function DraftPostsClient() {
  const [runtime] = useState(createDraftRuntime);
  const lifecycleGeneration = useRef(0);

  useEffect(() => {
    lifecycleGeneration.current += 1;

    return () => {
      const cleanupGeneration = ++lifecycleGeneration.current;
      queueMicrotask(() => {
        if (lifecycleGeneration.current === cleanupGeneration) {
          runtime.store.dispose();
          runtime.queryClient.clear();
        }
      });
    };
  }, [runtime]);

  return (
    <QueryClientProvider client={runtime.queryClient}>
      <main className="min-h-screen bg-gradient-to-b from-black to-slate-900 px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <Link
              href="/drafts"
              className="text-sm text-slate-400 transition hover:text-white"
            >
              ← All frontend drafts
            </Link>
            <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <div className="mb-3 inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  In-memory repository · no Supabase or Nest required
                </div>
                <h1 className="text-4xl font-bold">Advanced posts draft</h1>
                <p className="mt-3 max-w-3xl text-slate-300">
                  This is the production post UI, transformer, MobX view model,
                  TanStack Query lifecycle, and optimistic mutation pipeline.
                  Only its repository adapter is different.
                </p>
              </div>
              <p className="max-w-xs text-sm text-slate-400">
                Data resets when this page reloads.
              </p>
            </div>
          </div>

          <AdvancedPostsExampleView
            postStore={runtime.store}
            currentUserId={draftContext.currentUser?.id ?? "draft-user"}
          />
        </div>
      </main>
    </QueryClientProvider>
  );
}
