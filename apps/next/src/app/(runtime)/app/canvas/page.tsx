"use client";

import { AppPageHeader } from "@/components/app-showcase/app-page-header";
import { CollaborativeCanvas } from "@/components/examples/CollaborativeCanvas";
import useAuthGuard from "@/hooks/useAuthGuard";

export default function CanvasPage() {
  useAuthGuard();

  return (
    <>
      <AppPageHeader
        eyebrow="Full-runtime example"
        title="Collaborative canvas"
        description="A fixed world with presence in world coordinates. Every client resolves a point to the same place on the grid, whatever the size of its viewport."
      />
      <CollaborativeCanvas />
    </>
  );
}
