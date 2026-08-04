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
        title="Optimistic UI"
        description="The interface and the server, side by side, with the mutation pipeline running between them. Add latency or reject a request to watch the two diverge and converge again."
      />
      <AdvancedPostsExample />
    </>
  );
}
