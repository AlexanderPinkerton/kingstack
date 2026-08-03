"use client";

import { AppPageHeader } from "@/components/app-showcase/app-page-header";
import useAuthGuard from "@/hooks/useAuthGuard";
import { AdvancedPostsExample } from "@/lib/examples/advanced-posts-example";

export default function OptimisticStorePage() {
  useAuthGuard();

  return (
    <>
      <AppPageHeader
        eyebrow="Full-runtime example"
        title="Optimistic state"
        description="Inspect a production-connected store with transformations, filtering, analytics, optimistic mutations, rollback, and reconciliation."
      />
      <section className="rounded-[2rem] border border-white/10 bg-[#111216]/85 p-4 shadow-2xl shadow-black/20 sm:p-8">
        <AdvancedPostsExample />
      </section>
    </>
  );
}
