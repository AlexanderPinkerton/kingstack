"use client";

import useAuthGuard from "@/hooks/useAuthGuard";
import Link from "next/link";
import { AppNavbar } from "@/components/navbar/presets/app";
import { AnimatedBorderContainer } from "@/components/ui/animated-border-container";
import { NeonCard } from "@/components/ui/neon-card";
import { GradientText } from "@/components/ui/gradient-text";
import { RealtimeCheckboxes } from "@/components/examples/RealtimeCheckboxes";
import { ArrowLeft } from "lucide-react";

export default function RealtimePage() {
  useAuthGuard();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white flex flex-col">
      <AppNavbar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/home"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>

          <AnimatedBorderContainer>
            <NeonCard className="p-8">
              <div className="mb-8">
                <h1 className="text-4xl font-extrabold mb-4">
                  <GradientText>Realtime Sync</GradientText>
                </h1>
                <p className="text-lg text-slate-300">
                  Multi-user real-time synchronization with optimistic updates
                  and auto-rollback
                </p>
              </div>

              <RealtimeCheckboxes />
            </NeonCard>
          </AnimatedBorderContainer>
        </div>
      </main>
    </div>
  );
}
