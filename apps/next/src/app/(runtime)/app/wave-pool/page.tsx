"use client";

import { WavePool } from "@/components/examples/WavePool";
import useAuthGuard from "@/hooks/useAuthGuard";

export default function WavePoolPage() {
  useAuthGuard();

  return <WavePool />;
}
