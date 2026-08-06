"use client";

import { AppPageHeader } from "@/components/app-showcase/app-page-header";
import { WavePool } from "@/components/examples/WavePool";
import useAuthGuard from "@/hooks/useAuthGuard";

export default function WavePoolPage() {
  useAuthGuard();

  return (
    <>
      <AppPageHeader
        eyebrow="Full-runtime experiment"
        title="Global wave pool"
        description="One server-authoritative water surface shared by everyone on the site. Pointer trails and taps become waves that every connected client sees."
      />
      <WavePool />
    </>
  );
}
