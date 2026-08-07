"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Radio, RotateCcw } from "lucide-react";
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
      className="border-white/20 bg-black/60 text-white backdrop-blur-md hover:bg-white hover:text-black"
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
    <section className="relative left-1/2 -mb-20 -mt-28 min-h-[100svh] w-screen -translate-x-1/2 overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <PoolScene store={store} participantId={participantId} />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.07),transparent_26%),linear-gradient(to_bottom,rgba(0,0,0,0.16),transparent_45%,rgba(0,0,0,0.68))]"
      />

      <div className="pointer-events-none relative z-10 flex min-h-[100svh] flex-col px-5 pb-5 pt-24 sm:px-8 sm:pb-8 sm:pt-28 lg:px-12">
        <div className="flex items-start justify-between gap-8">
          <header className="max-w-xl">
            <div className="inline-flex items-center gap-2 border border-white/20 bg-black/45 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-white/70 backdrop-blur-md">
              <Radio className="size-3" aria-hidden="true" />
              Global simulation / live
            </div>
            <h1 className="mt-5 text-5xl font-semibold leading-[0.88] tracking-[-0.065em] sm:text-7xl lg:text-8xl">
              Make
              <br />a wave.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/60 sm:text-base sm:leading-7">
              One wireframe surface. One buoyant boat. Everyone on the site
              changes the same water.
            </p>
            <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white/45">
              <div>
                <dt className="sr-only">Field resolution</dt>
                <dd>64 × 40 field</dd>
              </div>
              <div>
                <dt className="sr-only">Render frequency</dt>
                <dd>60 Hz render</dd>
              </div>
              <div>
                <dt className="sr-only">Boat frequency</dt>
                <dd>30 Hz boat</dd>
              </div>
            </dl>
          </header>

          <div className="hidden border-r border-white/20 pr-4 text-right font-mono text-[0.6rem] uppercase leading-6 tracking-[0.16em] text-white/45 md:block">
            <p>Move / stir</p>
            <p>Click / pulse</p>
            <p>Right drag / orbit</p>
            <p>Wheel / zoom</p>
          </div>
        </div>

        <div className="mt-auto flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div className="max-w-full border border-white/15 bg-black/60 p-3 backdrop-blur-md">
            <PoolPresence store={store} />
          </div>
          <div className="pointer-events-auto flex flex-col items-start gap-2 sm:items-end">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-white/40 md:hidden">
              Move · click · right-drag · wheel
            </p>
            <PoolBoatReset store={store} />
          </div>
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
