import { POOL_ROOM_ID, normalizePoolPresenceState } from "@kingstack/shared";
import {
  PRESENCE_TONES,
  decodePresenceEvent,
  type PresenceEntry,
  type PresenceParticipant,
  type PresenceServerEvent,
} from "@/lib/realtime/presence-room";

interface ActiveViewpoint {
  participant: PresenceParticipant;
  x: number;
  y: number;
  z: number;
}

/** Fixed-capacity scene projection of other clients' camera positions. */
export class ViewpointBuffer {
  readonly positions: Float32Array;
  readonly tones: Uint8Array;
  count = 0;
  version = 0;

  private selfParticipantId: string | null = null;
  private readonly activeById = new Map<string, ActiveViewpoint>();
  private readonly slotById = new Map<string, number>();

  constructor(readonly capacity = 64) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError(
        "ViewpointBuffer capacity must be a positive integer",
      );
    }
    this.positions = new Float32Array(capacity * 3);
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
      if (this.activeById.delete(change.participantId)) this.rebuild();
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
    const state = normalizePoolPresenceState(entry.state);
    if (!state) {
      if (this.activeById.delete(entry.participant.id)) this.rebuild();
      return;
    }
    const previous = this.activeById.get(entry.participant.id);
    const next: ActiveViewpoint = {
      participant: entry.participant,
      ...state.viewpoint,
    };
    this.activeById.set(entry.participant.id, next);

    const slot = this.slotById.get(entry.participant.id);
    if (
      previous &&
      slot !== undefined &&
      previous.participant.tone === next.participant.tone
    ) {
      if (
        previous.x === next.x &&
        previous.y === next.y &&
        previous.z === next.z
      ) {
        return;
      }
      this.writePosition(slot, next);
      this.version += 1;
      return;
    }
    this.rebuild();
  }

  private storeEntry(entry: PresenceEntry<unknown>): void {
    const state = normalizePoolPresenceState(entry.state);
    if (!state) return;
    this.activeById.set(entry.participant.id, {
      participant: entry.participant,
      ...state.viewpoint,
    });
  }

  private rebuild(): void {
    this.slotById.clear();
    this.positions.fill(0);
    this.tones.fill(0);
    const viewpoints = Array.from(this.activeById.entries())
      .filter(([participantId]) => participantId !== this.selfParticipantId)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, this.capacity);
    this.count = viewpoints.length;
    viewpoints.forEach(([participantId, viewpoint], slot) => {
      this.slotById.set(participantId, slot);
      this.writePosition(slot, viewpoint);
      this.tones[slot] = Math.max(
        0,
        PRESENCE_TONES.indexOf(viewpoint.participant.tone),
      );
    });
    this.version += 1;
  }

  private writePosition(slot: number, viewpoint: ActiveViewpoint): void {
    const offset = slot * 3;
    this.positions[offset] = viewpoint.x;
    this.positions[offset + 1] = viewpoint.y;
    this.positions[offset + 2] = viewpoint.z;
  }
}
