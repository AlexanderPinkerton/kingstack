"use client";

import { AppPageHeader } from "@/components/app-showcase/app-page-header";
import { RealtimeCheckboxes } from "@/components/examples/RealtimeCheckboxes";
import useAuthGuard from "@/hooks/useAuthGuard";

export default function RealtimePage() {
  useAuthGuard();

  return (
    <>
      <AppPageHeader
        eyebrow="Full-runtime example"
        title="Realtime collaboration"
        description="Compare two isolated clients on one screen while optimistic writes, server events, presence, reconciliation, and cleanup work together."
      />
      <RealtimeCheckboxes />
    </>
  );
}
