import {
  POOL_ROOM_ID,
  POOL_WORLD,
  normalizePoolPoint,
  normalizePoolViewpoint,
  type PoolPoint,
  type PoolPresenceState,
  type PoolViewpoint,
} from "@kingstack/shared";
import type { RealtimeTransport } from "@/lib/realtime-manager";
import {
  PresenceRoom,
  type PresenceParticipant,
} from "@/lib/realtime/presence-room";

const POINTER_THROTTLE_MS = 33;
const POINTER_IDLE_MS = 10_000;

/** Pool-specific presence: one structural roster, pointer, and 3D viewpoint. */
export class PoolPresenceStore {
  private readonly room: PresenceRoom<PoolPresenceState>;
  private participant: PresenceParticipant | null = null;
  private pointer: PoolPoint | null = null;
  private viewpoint: PoolViewpoint | null = null;
  private idleHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(transport: RealtimeTransport) {
    this.room = new PresenceRoom(transport, POOL_ROOM_ID, {
      throttleMs: POINTER_THROTTLE_MS,
      structuralHasState: (state) => (state?.pointer ?? null) !== null,
    });
  }

  activate(): () => void {
    return this.room.activate();
  }

  dispose(): void {
    this.stopIdleTimer();
    this.room.dispose();
  }

  get participants(): PresenceParticipant[] {
    return this.room.participants;
  }

  get selfParticipant(): PresenceParticipant | null {
    return this.room.selfParticipant;
  }

  hasPointer(participantId: string): boolean {
    return this.room.hasState(participantId);
  }

  setParticipant(participant: PresenceParticipant): void {
    this.participant = participant;
    this.publish();
  }

  setPointer(x: number, z: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const point = normalizePoolPoint({
      x: Math.min(POOL_WORLD.width, Math.max(0, x)),
      y: Math.min(POOL_WORLD.depth, Math.max(0, z)),
    });
    if (!point) return;
    this.pointer = point;
    this.publish();
    this.restartIdleTimer();
  }

  clearPointer(): void {
    this.stopIdleTimer();
    if (this.pointer === null) return;
    this.pointer = null;
    this.publish();
  }

  setViewpoint(value: PoolViewpoint): void {
    const viewpoint = normalizePoolViewpoint(value);
    if (!viewpoint) return;
    this.viewpoint = viewpoint;
    this.publish();
  }

  emitTap(x: number, z: number): void {
    const point = normalizePoolPoint({ x, y: z });
    if (!point) return;
    this.room.sendSignal("ripple", point);
  }

  emitBoatReset(): boolean {
    if (!this.participant) return false;
    this.room.sendSignal("reset-boat", true);
    return true;
  }

  private publish(): void {
    if (!this.participant) return;
    if (!this.viewpoint) {
      this.room.setSelf(this.participant, null);
      return;
    }
    this.room.setSelf(this.participant, {
      pointer: this.pointer,
      viewpoint: this.viewpoint,
    });
  }

  private restartIdleTimer(): void {
    this.stopIdleTimer();
    this.idleHandle = setTimeout(() => {
      this.idleHandle = null;
      this.clearPointer();
    }, POINTER_IDLE_MS);
  }

  private stopIdleTimer(): void {
    if (this.idleHandle === null) return;
    clearTimeout(this.idleHandle);
    this.idleHandle = null;
  }
}
