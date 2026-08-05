"use client";

import { observer } from "mobx-react-lite";
import { PRESENCE_TONE_COLORS } from "@/components/collaboration/presence-tones";
import type { SharedCursorStore } from "@/stores/userApp/sharedCursorStore";

interface CursorOverlayProps {
  store: SharedCursorStore;
  /**
   * Extent of the room's coordinate space. Defaults to the unit square, which
   * is right for surface-fraction rooms; a canvas room passes its world size.
   */
  space?: { width: number; height: number };
}

/**
 * Draws every peer pointer inside the surface bound by `useSharedCursors`.
 * Render it as the last child of that surface; it covers the surface but never
 * receives events, so the underlying UI stays fully interactive.
 */
export const CursorOverlay = observer(function CursorOverlay({
  store,
  space = { width: 1, height: 1 },
}: CursorOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      // Makes the overlay the resolution context for the cqw/cqh units below,
      // so cursors can be placed with a transform instead of left/top.
      style={{ containerType: "size" }}
    >
      {store.cursors.map(({ participant, state }) => {
        const color = PRESENCE_TONE_COLORS[participant.tone];

        return (
          <div
            key={participant.id}
            className="absolute left-0 top-0 will-change-transform"
            style={{
              // Translating a fixed-origin node keeps the whole cursor on the
              // compositor; animating left/top would relayout every frame.
              transform: `translate3d(${(state.x / space.width) * 100}cqw, ${(state.y / space.height) * 100}cqh, 0)`,
              transition: "transform 90ms linear",
            }}
          >
            <svg
              width="18"
              height="22"
              viewBox="0 0 18 22"
              fill="none"
              className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
            >
              <path
                d="M1 1L1 16.2L5.1 12.4L7.9 18.9L10.7 17.7L8 11.4L13.4 11.1L1 1Z"
                fill={color}
                stroke="#0c0d10"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="ml-3.5 mt-0.5 inline-block max-w-32 truncate rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold text-[#11130d]"
              style={{ backgroundColor: color }}
            >
              {participant.name}
            </span>
          </div>
        );
      })}
    </div>
  );
});
