// Wire format for room membership and ephemeral presence.
//
// Presence is deliberately generic: the envelope (room, participant, identity)
// is validated here, while the feature-specific `state` payload is validated by
// the room namespace that owns it. Nothing in this file knows what a checkbox
// or a cursor is.

export const PRESENCE_TONES = [
  "lime",
  "violet",
  "cyan",
  "amber",
  "coral",
] as const;

export type PresenceTone = (typeof PRESENCE_TONES)[number];

export interface PresenceParticipant {
  id: string;
  name: string;
  tone: PresenceTone;
}

export interface PresenceEntry<TState = unknown> {
  participant: PresenceParticipant;
  /** Feature-specific position within the room. `null` means present but idle. */
  state: TState | null;
}

/** Client -> server. */
export interface PresenceSetPayload {
  roomId?: unknown;
  participant?: unknown;
  state?: unknown;
}

/** Client -> server. */
export interface RoomPayload {
  roomId?: unknown;
}

/** Server -> client, single `presence` channel with a discriminated action. */
export type PresenceServerEvent<TState = unknown> =
  | { type: "presence"; roomId: string; action: "sync"; entries: PresenceEntry<TState>[] }
  | { type: "presence"; roomId: string; action: "upsert"; entry: PresenceEntry<TState> }
  | { type: "presence"; roomId: string; action: "remove"; participantId: string };

export const PARTICIPANT_ID_MAX_LENGTH = 100;
export const PARTICIPANT_NAME_MAX_LENGTH = 40;
export const ROOM_ID_MAX_LENGTH = 64;

const ROOM_ID_PATTERN = /^[a-z0-9-]+:[a-z0-9-]+$/;

/**
 * Room ids are `<namespace>:<scope>`, e.g. `checkboxes:global`. The namespace
 * selects the validator and auth policy; the scope isolates one document,
 * board, or demo instance from another.
 */
export function normalizeRoomId(roomId: unknown): string | null {
  if (typeof roomId !== "string") return null;
  const trimmed = roomId.trim();
  if (trimmed.length === 0 || trimmed.length > ROOM_ID_MAX_LENGTH) return null;
  if (!ROOM_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function roomNamespaceOf(roomId: string): string {
  return roomId.slice(0, roomId.indexOf(":"));
}

export function normalizeParticipant(
  participant: unknown,
): PresenceParticipant | null {
  if (typeof participant !== "object" || participant === null) return null;

  const candidate = participant as Record<string, unknown>;
  const id = candidate.id;
  const tone = candidate.tone;
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";

  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > PARTICIPANT_ID_MAX_LENGTH ||
    name.length === 0 ||
    name.length > PARTICIPANT_NAME_MAX_LENGTH ||
    typeof tone !== "string" ||
    !(PRESENCE_TONES as readonly string[]).includes(tone)
  ) {
    return null;
  }

  return { id, name, tone: tone as PresenceTone };
}
