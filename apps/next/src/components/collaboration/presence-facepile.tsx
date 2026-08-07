"use client";

import { Circle, MousePointer2 } from "lucide-react";
import { PRESENCE_TONE_COLORS } from "@/components/collaboration/presence-tones";
import type { PresenceParticipant } from "@/lib/realtime/presence-room";

export interface PresenceFacepileProps {
  participants: PresenceParticipant[];
  /** Marked as "You" and sorted first. */
  selfId?: string | null;
  /**
   * Whether a participant is publishing a pointer right now. This is a fact
   * about their cursor, not about their device: a touch client never publishes
   * one, and a desktop client that has not moved yet also does not. Either way
   * they are present, so they are shown with a quieter indicator rather than
   * omitted.
   */
  hasPointer?: (participantId: string) => boolean;
  emptyLabel?: string;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function PresenceFacepile({
  participants,
  selfId = null,
  hasPointer,
  emptyLabel = "Nobody here yet",
}: PresenceFacepileProps) {
  if (participants.length === 0) {
    return <p className="text-sm text-white/40">{emptyLabel}</p>;
  }

  const ordered = [...participants].sort((a, b) => {
    if (a.id === selfId) return -1;
    if (b.id === selfId) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-white/40">
        {ordered.length} {ordered.length === 1 ? "person" : "people"} here
      </span>

      <ul className="flex flex-wrap gap-2">
        {ordered.map((participant) => {
          const color = PRESENCE_TONE_COLORS[participant.tone];
          const pointing = hasPointer?.(participant.id) ?? true;
          const Indicator = pointing ? MousePointer2 : Circle;

          return (
            <li
              key={participant.id}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0c0d10] py-1.5 pl-1.5 pr-3"
            >
              <span
                className="grid size-7 place-items-center rounded-full text-[0.6rem] font-bold text-[#11130d]"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              >
                {initials(participant.name)}
              </span>
              <span className="max-w-28 truncate text-xs font-medium sm:max-w-40">
                {participant.name}
              </span>
              {participant.id === selfId && (
                <span className="text-[0.6rem] uppercase tracking-[0.12em] text-white/30">
                  You
                </span>
              )}
              <Indicator
                className={`size-3 ${pointing ? "text-white/35" : "text-white/20"}`}
                aria-label={
                  pointing ? "Sharing a cursor" : "Present, no cursor"
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
