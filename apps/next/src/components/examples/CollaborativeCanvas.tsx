"use client";

import { useMemo, useState } from "react";
import { Crosshair, Frame, Radio } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRootStore } from "@/hooks/useRootStore";
import { useCanvasCursors } from "@/hooks/useSharedCursors";
import { CursorOverlay } from "@/components/collaboration/cursor-overlay";
import {
  CANVAS_GRID_MAJOR_EVERY,
  CANVAS_GRID_STEP,
  CANVAS_WORLD,
  formatWorldPoint,
} from "@/lib/realtime/canvas-world";
import {
  createParticipantId,
  toneForParticipantId,
} from "@/lib/realtime/presence-room";
import { PRESENCE_TONE_COLORS } from "@/components/collaboration/presence-tones";
import { PresenceFacepile } from "@/components/collaboration/presence-facepile";
import { RippleLayer } from "@/components/collaboration/ripple-layer";
import type { SharedCursorStore } from "@/stores/userApp/sharedCursorStore";

/** Everyone viewing this page shares one world. */
const CANVAS_SCOPE = "world";

function GridLines() {
  const { verticals, horizontals } = useMemo(() => {
    const verticals: number[] = [];
    const horizontals: number[] = [];
    for (let x = 0; x <= CANVAS_WORLD.width; x += CANVAS_GRID_STEP) {
      verticals.push(x);
    }
    for (let y = 0; y <= CANVAS_WORLD.height; y += CANVAS_GRID_STEP) {
      horizontals.push(y);
    }
    return { verticals, horizontals };
  }, []);

  const isMajor = (value: number) =>
    (value / CANVAS_GRID_STEP) % CANVAS_GRID_MAJOR_EVERY === 0;

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full"
      viewBox={`0 0 ${CANVAS_WORLD.width} ${CANVAS_WORLD.height}`}
      // "none" makes the grid fill the box on exactly the same terms as the
      // cursor overlay's percentage positioning, so the two can never disagree
      // about where a world point is, even if the stage is off by a pixel.
      preserveAspectRatio="none"
    >
      {verticals.map((x) => (
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={CANVAS_WORLD.height}
          stroke="#ffffff"
          strokeOpacity={isMajor(x) ? 0.14 : 0.06}
          strokeWidth={isMajor(x) ? 2 : 1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {horizontals.map((y) => (
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={CANVAS_WORLD.width}
          y2={y}
          stroke="#ffffff"
          strokeOpacity={isMajor(y) ? 0.14 : 0.06}
          strokeWidth={isMajor(y) ? 2 : 1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

const RoomPresence = observer(function RoomPresence({
  store,
}: {
  store: SharedCursorStore;
}) {
  return (
    <PresenceFacepile
      participants={store.participants}
      selfId={store.selfParticipant?.id ?? null}
      hasPointer={(participantId) => store.hasPointer(participantId)}
      emptyLabel="Connecting to the canvas…"
    />
  );
});

/**
 * The proof, not decoration: two devices hovering the same gridline read the
 * same numbers here.
 */
const CoordinateReadout = observer(function CoordinateReadout({
  store,
}: {
  store: SharedCursorStore;
}) {
  const cursors = store.cursors;

  if (cursors.length === 0) {
    return (
      <p className="text-sm text-white/40">
        No other cursors right now. Open this page on another device — tap the
        grid there and the ripple will land in the same square here.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {cursors.map(({ participant, state }) => (
        <li
          key={participant.id}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0c0d10] py-1.5 pl-2.5 pr-3"
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: PRESENCE_TONE_COLORS[participant.tone] }}
            aria-hidden="true"
          />
          <span className="max-w-32 truncate text-xs font-medium">
            {participant.name}
          </span>
          <span className="font-mono text-[0.7rem] tabular-nums text-white/40">
            {formatWorldPoint(state.x, state.y)}
          </span>
        </li>
      ))}
    </ul>
  );
});

export const CollaborativeCanvas = observer(function CollaborativeCanvas() {
  const rootStore = useRootStore();
  const sessionUser = rootStore.session?.user;
  const displayName =
    rootStore.userData?.displayName ||
    sessionUser?.user_metadata?.username ||
    sessionUser?.email?.split("@")[0] ||
    "You";

  // Identity is per tab, so two tabs of one account read as two people.
  const [participantId] = useState(() => createParticipantId("canvas"));
  const participant = useMemo(
    () => ({
      id: participantId,
      name: displayName,
      tone: toneForParticipantId(participantId),
    }),
    [participantId, displayName],
  );

  const { store, surfaceRef } = useCanvasCursors(CANVAS_SCOPE, participant);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#111216]/85 p-4 shadow-2xl shadow-black/20 sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 92% 0%, rgba(142, 232, 255, 0.16), transparent 36%), radial-gradient(circle at 8% 0%, rgba(216, 255, 112, 0.06), transparent 28%)",
        }}
      />

      <div className="relative">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs text-white/55">
            <Radio className="size-3 text-[#8ee8ff]" aria-hidden="true" />
            World-space presence
          </div>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">
            One world. Every screen.
            <span className="block font-gambetta font-normal italic text-white/45">
              The same point, everywhere.
            </span>
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/50 sm:text-lg sm:leading-8">
            Cursors here are published in {CANVAS_WORLD.width}×
            {CANVAS_WORLD.height} world units, not as a fraction of anyone&rsquo;s
            viewport. The stage is locked to the world&rsquo;s aspect ratio, so a
            point lands on the same gridline whether you are on a laptop or a
            phone. Compare the readout on two devices. Tap anywhere to leave a
            ripple — the one thing a touch client can say when it has no pointer
            to publish.
          </p>
        </div>

        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
          {[
            {
              icon: Frame,
              label: "Fixed world",
              detail: `${CANVAS_WORLD.width}×${CANVAS_WORLD.height} units`,
            },
            {
              icon: Crosshair,
              label: "Device independent",
              detail: "Aspect-locked stage, uniform scale",
            },
            {
              icon: Radio,
              label: "Never persisted",
              detail: "Presence only, no database writes",
            },
          ].map(({ icon: Icon, label, detail }) => (
            <div key={label} className="bg-[#0c0d10] px-5 py-4">
              <Icon className="size-4 text-[#8ee8ff]" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">{label}</p>
              <p className="mt-1 text-xs text-white/35">{detail}</p>
            </div>
          ))}
        </div>

        <div
          ref={surfaceRef}
          className="relative mt-6 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a0b0e]"
          // The one constraint that makes world coordinates agree: the stage
          // is always the world's shape, so scaling it is uniform.
          style={{ aspectRatio: `${CANVAS_WORLD.width} / ${CANVAS_WORLD.height}` }}
        >
          <GridLines />
          <RippleLayer store={store} space={CANVAS_WORLD} />
          <CursorOverlay store={store} space={CANVAS_WORLD} />
        </div>

        <div className="mt-5 space-y-4">
          <RoomPresence store={store} />
          <CoordinateReadout store={store} />
        </div>
      </div>
    </section>
  );
});
