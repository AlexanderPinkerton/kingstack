"use client";

import { AppPageHeader } from "@/components/app-showcase/app-page-header";
import { CollaborativeCanvas } from "@/components/examples/CollaborativeCanvas";
import { GuestDemoGate } from "@/components/examples/guest-access/guest-demo-gate";

export default function CanvasPage() {
  return (
    <GuestDemoGate>
      <>
        <AppPageHeader
          eyebrow="Live guest demo"
          title="Collaborative canvas"
          description="A fixed world with presence in world coordinates. Every client resolves a point to the same place on the grid, whatever the size of its viewport."
        />
        <CollaborativeCanvas />
      </>
    </GuestDemoGate>
  );
}
