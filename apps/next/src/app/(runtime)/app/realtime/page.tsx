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
        title="Realtime synchronization"
        description="Open this page in multiple sessions to exercise optimistic feedback, server events, reconciliation, and rollback together."
      />
      <section className="rounded-[2rem] border border-white/10 bg-[#111216]/85 p-4 shadow-2xl shadow-black/20 sm:p-8">
        <RealtimeCheckboxes />
      </section>
    </>
  );
}
