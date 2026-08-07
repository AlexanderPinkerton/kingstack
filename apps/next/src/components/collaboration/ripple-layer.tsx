"use client";

import { observer } from "mobx-react-lite";
import { PRESENCE_TONE_COLORS } from "@/components/collaboration/presence-tones";
import type { SharedCursorStore } from "@/stores/userApp/sharedCursorStore";

interface RippleLayerProps {
  store: SharedCursorStore;
  /** Extent of the room's coordinate space, matching CursorOverlay. */
  space?: { width: number; height: number };
}

/**
 * Expanding rings where people tapped. Each ripple is a one-shot signal rather
 * than presence, so it is drawn once and retired by the store; nothing here
 * persists or replays.
 */
export const RippleLayer = observer(function RippleLayer({
  store,
  space = { width: 1, height: 1 },
}: RippleLayerProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      style={{ containerType: "size" }}
    >
      {store.ripples.map(({ id, participant, point, hadPointer }) => {
        const color = PRESENCE_TONE_COLORS[participant.tone];

        return (
          <span
            key={id}
            className="absolute left-0 top-0 block size-0"
            style={{
              transform: `translate3d(${(point.x / space.width) * 100}cqw, ${(point.y / space.height) * 100}cqh, 0)`,
            }}
          >
            <span
              className="absolute left-0 top-0 block rounded-full border-2"
              style={{
                borderColor: color,
                animation: "kingstack-ripple 1.2s ease-out forwards",
              }}
            />

            {/* A tap from a client with a cursor is already labelled by that
                cursor. One without needs to say who it was. */}
            {!hadPointer && (
              <span
                className="absolute left-0 top-0 block max-w-32 truncate rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold text-[#11130d]"
                style={{
                  backgroundColor: color,
                  animation: "kingstack-ripple-label 1.2s ease-out forwards",
                }}
              >
                {participant.name}
              </span>
            )}
          </span>
        );
      })}

      <style>{`
        @keyframes kingstack-ripple {
          from {
            width: 0;
            height: 0;
            margin: 0;
            opacity: 0.85;
          }
          to {
            width: 5.5rem;
            height: 5.5rem;
            margin: -2.75rem;
            opacity: 0;
          }
        }
        @keyframes kingstack-ripple-label {
          from { opacity: 0; transform: translate(-50%, 1.25rem); }
          25%  { opacity: 1; transform: translate(-50%, 0.75rem); }
          70%  { opacity: 1; transform: translate(-50%, 0.75rem); }
          to   { opacity: 0; transform: translate(-50%, 0.25rem); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes kingstack-ripple {
            from { width: 2rem; height: 2rem; margin: -1rem; opacity: 0.7; }
            to   { width: 2rem; height: 2rem; margin: -1rem; opacity: 0; }
          }
          @keyframes kingstack-ripple-label {
            from { opacity: 1; transform: translate(-50%, 0.75rem); }
            70%  { opacity: 1; transform: translate(-50%, 0.75rem); }
            to   { opacity: 0; transform: translate(-50%, 0.75rem); }
          }
        }
      `}</style>
    </div>
  );
});
