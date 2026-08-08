"use client";

import { ArrowUpRight } from "lucide-react";
import { AppPageHeader } from "@/components/app-showcase/app-page-header";
import { AdvancedPostsExample } from "@/lib/examples/advanced-posts-example";

const PACKAGE_URL =
  "https://github.com/AlexanderPinkerton/kingstack/tree/main/packages/advanced-optimistic-store";

export default function OptimisticStorePage() {
  return (
    <>
      <AppPageHeader
        eyebrow="Open demo · browser-local data"
        title="Optimistic UI"
        description="The interface and an in-memory repository, side by side, with the real mutation pipeline running between them. Add latency or reject a request to watch the two diverge and converge again without writing permanent data."
      />
      <a
        href={PACKAGE_URL}
        target="_blank"
        rel="noreferrer"
        className="-mt-4 mb-8 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/45 transition hover:border-[#d8ff70]/35 hover:text-white"
      >
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-[#d8ff70]"
        />
        <span className="shrink-0">Powered by</span>
        <code className="truncate font-mono text-white/70">
          @kingstack/advanced-optimistic-store
        </code>
        <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
      </a>
      <AdvancedPostsExample />
    </>
  );
}
