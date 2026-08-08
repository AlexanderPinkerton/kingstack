"use client";

import { AppPageHeader } from "@/components/app-showcase/app-page-header";
import { GuestDemoGate } from "@/components/examples/guest-access/guest-demo-gate";
import { RealtimeCheckboxes } from "@/components/examples/RealtimeCheckboxes";

export default function RealtimePage() {
  return (
    <GuestDemoGate
      title="Join the shared realtime grid."
      description="KingStack creates a temporary guest identity, then uses its real JWT for Socket.IO presence and bounded checkbox mutations."
    >
      <>
        <AppPageHeader
          eyebrow="Live guest demo"
          title="Realtime collaboration"
          description="Compare two isolated clients on one screen while optimistic writes, server events, presence, reconciliation, and cleanup work together."
        />
        <RealtimeCheckboxes />
      </>
    </GuestDemoGate>
  );
}
