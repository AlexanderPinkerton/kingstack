"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  MousePointerClick,
  Radio,
  RotateCcw,
  Waves,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { PresenceFacepile } from "@/components/collaboration/presence-facepile";
import { Button } from "@/components/ui/button";
import { useRootStore } from "@/hooks/useRootStore";
import { useWavePool } from "@/hooks/useWavePool";
import { browserLogger } from "@/lib/browser-logger";
import { PoolRenderer } from "@/lib/pool/pool-renderer";
import { PoolSurfaceController } from "@/lib/pool/pool-surface";
import {
  createParticipantId,
  toneForParticipantId,
} from "@/lib/realtime/presence-room";
import type { WavePoolStore } from "@/stores/userApp/wavePoolStore";

const logger = browserLogger.child({ component: "WavePool" });

const PoolScene = memo(function PoolScene({
  store,
  participantId,
}: {
  store: WavePoolStore;
  participantId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: PoolRenderer | null = null;
    let surface: PoolSurfaceController | null = null;
    try {
      renderer = new PoolRenderer(
        canvas,
        store.field,
        store.cursorBuffer,
        store.viewpointBuffer,
        store.boat,
        {
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
          initialAzimuth: azimuthForParticipantId(participantId),
        },
      );
      surface = new PoolSurfaceController(store, renderer);
      surface.attach(canvas);
      renderer.start();
    } catch (error) {
      logger.error("wave_pool.webgl_initialization_failed", { error });
    }

    return () => {
      surface?.dispose();
      renderer?.dispose();
    };
  }, [participantId, store]);

  return (
    <canvas
      ref={canvasRef}
      className="block size-full cursor-crosshair touch-pan-y"
      aria-label="Interactive global wave pool. Move the pointer to disturb the water, click for a wave, right-drag to orbit, and use the wheel to zoom."
    />
  );
});

const PoolPresence = observer(function PoolPresence({
  store,
}: {
  store: WavePoolStore;
}) {
  return (
    <PresenceFacepile
      participants={store.cursors.participants}
      selfId={store.cursors.selfParticipant?.id ?? null}
      hasPointer={(participantId) => store.cursors.hasPointer(participantId)}
      emptyLabel="Connecting to the global pool…"
    />
  );
});

const PoolBoatReset = observer(function PoolBoatReset({
  store,
}: {
  store: WavePoolStore;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!store.boatReset.canReset}
      onClick={() => store.resetBoat()}
      title="Reset the shared boat to the center of the pool"
    >
      <RotateCcw aria-hidden="true" />
      <span aria-live="polite">{store.boatReset.label}</span>
    </Button>
  );
});

export const WavePool = observer(function WavePool() {
  const rootStore = useRootStore();
  const sessionUser = rootStore.session?.user;
  const displayName =
    rootStore.userData?.displayName ||
    sessionUser?.user_metadata?.username ||
    sessionUser?.email?.split("@")[0] ||
    "You";
  const [participantId] = useState(() => createParticipantId("pool"));
  const participant = useMemo(
    () => ({
      id: participantId,
      name: displayName,
      tone: toneForParticipantId(participantId),
    }),
    [displayName, participantId],
  );
  const store = useWavePool(participant);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#111216]/85 p-4 shadow-2xl shadow-black/20 sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 90% 0%, color-mix(in oklch, var(--accent-1-m) 22%, transparent), transparent 38%), radial-gradient(circle at 8% 4%, color-mix(in oklch, var(--accent-2-m) 12%, transparent), transparent 30%)",
        }}
      />

      <div className="relative">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs text-white/55">
            <Radio
              className="size-3 text-[var(--accent-1-m)]"
              aria-hidden="true"
            />
            One global simulation
          </div>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">
            Make a wave. Share the water.
            <span className="block font-gambetta font-normal italic text-white/45">
              Everyone changes the same pool.
            </span>
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/50 sm:text-lg sm:leading-8">
            Make waves to push the shared boat, or right-drag to watch from a
            different side. The Nest server advances one authoritative field and
            boat for the entire site, so every person here changes the same
            water. Colored 3D markers show where everyone else is watching from.
          </p>
        </div>

        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
          {[
            {
              icon: Waves,
              label: "One field",
              detail: "64×40 authoritative cells",
            },
            {
              icon: Activity,
              label: "Smooth playback",
              detail: "60Hz render, 30Hz boat",
            },
            {
              icon: MousePointerClick,
              label: "Shared boat",
              detail: "Buoyancy, pitch, and roll",
            },
          ].map(({ icon: Icon, label, detail }) => (
            <div key={label} className="bg-[#0c0d10] px-5 py-4">
              <Icon
                className="size-4 text-[var(--accent-1-m)]"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-medium">{label}</p>
              <p className="mt-1 text-xs text-white/35">{detail}</p>
            </div>
          ))}
        </div>

        <div
          className="relative mt-6 aspect-[16/9] min-h-72 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#070b11] shadow-inner shadow-black/50"
          role="group"
          aria-label="Wave pool controls"
        >
          <PoolScene store={store} participantId={participantId} />
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[0.68rem] text-white/45 backdrop-blur-md">
            Move to stir · Click for a pulse · Right-drag to orbit · Wheel to
            zoom
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PoolPresence store={store} />
          <PoolBoatReset store={store} />
        </div>
      </div>
    </section>
  );
});

function azimuthForParticipantId(participantId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < participantId.length; index += 1) {
    hash ^= participantId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 0xffffffff) * Math.PI * 2;
}
