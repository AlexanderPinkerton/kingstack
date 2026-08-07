import { POOL_ROOM_ID, normalizePoolPresenceState } from "@kingstack/shared";
import {
  PRESENCE_TONES,
  decodePresenceEvent,
  type PresenceEntry,
  type PresenceParticipant,
  type PresenceServerEvent,
} from "@/lib/realtime/presence-room";

interface ActiveCursor {
  participant: PresenceParticipant;
  x: number;
  z: number;
}

/** Allocation-bounded projection for the renderer's remote cursor sprites. */
export class CursorBuffer {
  readonly positions: Float32Array;
  readonly tones: Uint8Array;

  count = 0;
  version = 0;

  private selfParticipantId: string | null = null;
  private readonly activeById = new Map<string, ActiveCursor>();
  private readonly slotById = new Map<string, number>();

  constructor(readonly capacity = 64) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError("CursorBuffer capacity must be a positive integer");
    }
    this.positions = new Float32Array(capacity * 2);
    this.tones = new Uint8Array(capacity);
  }

  setSelfParticipantId(participantId: string | null): void {
    if (participantId === this.selfParticipantId) return;
    this.selfParticipantId = participantId;
    this.rebuild();
  }

  apply(event: PresenceServerEvent<unknown>): boolean {
    const change = decodePresenceEvent<unknown>(POOL_ROOM_ID, event);
    if (!change) return false;

    if (change.operation === "sync") {
      this.activeById.clear();
      change.entries.forEach((entry) => this.storeEntry(entry));
      this.rebuild();
      return true;
    }

    if (change.operation === "remove") {
      if (!this.activeById.delete(change.participantId)) return true;
      this.rebuild();
      return true;
    }

    this.upsert(change.entry);
    return true;
  }

  clear(): void {
    this.activeById.clear();
    this.slotById.clear();
    this.positions.fill(0);
    this.tones.fill(0);
    this.count = 0;
    this.version += 1;
  }

  private upsert(entry: PresenceEntry<unknown>): void {
    const point = normalizePoolPresenceState(entry.state)?.pointer ?? null;
    if (!point) {
      if (this.activeById.delete(entry.participant.id)) this.rebuild();
      return;
    }

    const previous = this.activeById.get(entry.participant.id);
    const toneChanged = previous?.participant.tone !== entry.participant.tone;
    this.activeById.set(entry.participant.id, {
      participant: entry.participant,
      x: point.x,
      z: point.y,
    });

    const slot = this.slotById.get(entry.participant.id);
    if (previous && slot !== undefined && !toneChanged) {
      if (previous.x === point.x && previous.z === point.y) return;
      this.writePosition(slot, point.x, point.y);
      this.version += 1;
      return;
    }

    this.rebuild();
  }

  private storeEntry(entry: PresenceEntry<unknown>): void {
    const point = normalizePoolPresenceState(entry.state)?.pointer ?? null;
    if (!point) return;
    this.activeById.set(entry.participant.id, {
      participant: entry.participant,
      x: point.x,
      z: point.y,
    });
  }

  private rebuild(): void {
    this.slotById.clear();
    this.positions.fill(0);
    this.tones.fill(0);

    const cursors = Array.from(this.activeById.entries())
      .filter(([participantId]) => participantId !== this.selfParticipantId)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, this.capacity);

    this.count = cursors.length;
    cursors.forEach(([participantId, cursor], slot) => {
      this.slotById.set(participantId, slot);
      this.writePosition(slot, cursor.x, cursor.z);
      this.tones[slot] = Math.max(
        0,
        PRESENCE_TONES.indexOf(cursor.participant.tone),
      );
    });
    this.version += 1;
  }

  private writePosition(slot: number, x: number, z: number): void {
    const offset = slot * 2;
    this.positions[offset] = x;
    this.positions[offset + 1] = z;
  }
}
