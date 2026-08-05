import type { PresenceTone } from "@/lib/realtime/presence-room";

/**
 * One colour per presence tone, drawn from the site palette. Tones are assigned
 * deterministically from a participant id, so the same person looks the same to
 * everyone in the room.
 */
export const PRESENCE_TONE_COLORS: Record<PresenceTone, string> = {
  lime: "#d8ff70",
  violet: "#a89cff",
  cyan: "#8ee8ff",
  amber: "#f9da7f",
  coral: "#ff9c6e",
};
