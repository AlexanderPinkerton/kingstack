"use client";

import { ArrowRight, Crown, Radio, Waves } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRootStore } from "@/hooks/useRootStore";
import { WavePool } from "../WavePool";

export const WavePoolEntry = observer(function WavePoolEntry() {
  const rootStore = useRootStore();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!rootStore.sessionReady) {
    return (
      <section className="relative left-1/2 -mb-20 -mt-28 grid min-h-[100svh] w-screen -translate-x-1/2 place-items-center bg-black text-white/50">
        Preparing the live pool…
      </section>
    );
  }

  if (rootStore.session) return <WavePool />;

  async function enterAsGuest(): Promise<void> {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await rootStore.startGuestSession();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The guest session could not be created.",
      );
      setPending(false);
    }
  }

  return (
    <section className="relative left-1/2 -mb-20 -mt-28 grid min-h-[100svh] w-screen -translate-x-1/2 place-items-center overflow-hidden bg-[#050608] px-5 py-28 text-[#f5f2e8]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(circle at 70% 18%, rgba(118, 85, 255, 0.22), transparent 32%), radial-gradient(circle at 22% 76%, rgba(216, 255, 112, 0.12), transparent 30%)",
        }}
      />

      <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#101115]/90 p-7 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-12">
        <div className="flex items-center justify-between gap-6">
          <span className="grid size-11 place-items-center rounded-full border border-white/15 bg-white/[0.05]">
            <Crown className="size-5 text-[#d8ff70]" aria-hidden="true" />
          </span>
          <span className="inline-flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-white/45">
            <Radio className="size-3 text-[#d8ff70]" aria-hidden="true" />
            Live shared system
          </span>
        </div>

        <Waves className="mt-14 size-8 text-[#a89cff]" aria-hidden="true" />
        <p className="mt-5 text-xs font-medium uppercase tracking-[0.18em] text-[#d8ff70]">
          Global wave pool
        </p>
        <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-[0.95] tracking-[-0.055em] sm:text-7xl">
          Enter the same water as everyone else.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-white/55">
          One click creates a temporary Supabase guest, verifies its JWT in
          NestJS, and joins the server-authoritative simulation. No form and no
          persisted app data.
        </p>

        <div className="mt-10">
          <Button
            type="button"
            size="lg"
            disabled={pending}
            onClick={() => void enterAsGuest()}
            className="bg-[#d8ff70] text-[#11130d] hover:bg-[#e3ff98]"
          >
            {pending ? "Starting demo…" : "Start guest demo"}
            {!pending && <ArrowRight aria-hidden="true" />}
          </Button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 border-l-2 border-[#ff8b7b] pl-3 text-sm text-[#ffb6ac]"
          >
            {error}
          </p>
        )}

        <p className="mt-8 max-w-xl font-mono text-[0.62rem] uppercase leading-5 tracking-[0.12em] text-white/30">
          No signup required. The temporary guest token authenticates this live
          connection and is limited to the wave-pool room. It cannot write posts
          or other shared database data.
        </p>
      </div>
    </section>
  );
});
