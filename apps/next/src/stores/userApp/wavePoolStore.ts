import { POOL_ROOM_ID, POOL_WORLD } from "@kingstack/shared";
import { browserLogger } from "@/lib/browser-logger";
import { CursorBuffer } from "@/lib/pool/cursor-buffer";
import { PoolField } from "@/lib/pool/pool-field";
import type { RealtimeTransport } from "@/lib/realtime-manager";
import type {
  PresenceParticipant,
  PresenceServerEvent,
} from "@/lib/realtime/presence-room";
import { StoreDemand } from "@/lib/store-lifecycle";
import { SharedCursorStore } from "./sharedCursorStore";

const logger = browserLogger.child({ component: "WavePoolStore" });

function poolProjection(x: number, z: number): { x: number; y: number } {
  return {
    x: Math.min(POOL_WORLD.width, Math.max(0, x)),
    y: Math.min(POOL_WORLD.depth, Math.max(0, z)),
  };
}

/** Owns the one global pool's field, pointer stream, and room lease. */
export class WavePoolStore {
  readonly field = new PoolField();
  readonly cursorBuffer = new CursorBuffer();
  readonly cursors: SharedCursorStore;

  private readonly demand: StoreDemand;
  private releasePool: (() => void) | null = null;
  private releasePresence: (() => void) | null = null;
  private releaseCursors: (() => void) | null = null;
  private disposed = false;

  constructor(private readonly transport: RealtimeTransport) {
    this.cursors = new SharedCursorStore(transport, POOL_ROOM_ID, {
      projection: poolProjection,
      trackRipples: false,
    });
    this.demand = new StoreDemand(() => this.syncDemand());
  }

  activate(): () => void {
    return this.demand.activate();
  }

  setParticipant(participant: PresenceParticipant): void {
    this.cursorBuffer.setSelfParticipantId(participant.id);
    this.cursors.setParticipant(participant);
  }

  setPointer(x: number, z: number): void {
    this.cursors.setPointer(x, z);
  }

  clearPointer(): void {
    this.cursors.clearPointer();
  }

  emitTap(x: number, z: number): void {
    this.cursors.emitTap(x, z);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disconnect();
    this.demand.dispose();
    this.cursors.dispose();
  }

  private syncDemand(): void {
    if (this.demand.isActive && !this.releaseCursors) {
      // Subscribe before acquiring the room. The server sends a reliable
      // keyframe during join, so reversing this order can lose the first frame.
      this.releasePool = this.transport.subscribe<unknown>("pool", (event) => {
        const result = this.field.apply(event);
        if (result.status === "gap") {
          logger.warn("wave_pool.sequence_gap", {
            expected: result.expected,
            received: result.received,
          });
        } else if (result.status === "ignored" && result.reason !== "stale") {
          logger.debug("wave_pool.frame_ignored", { reason: result.reason });
        }
      });
      this.releasePresence = this.transport.subscribe<
        PresenceServerEvent<unknown>
      >("presence", (event) => this.cursorBuffer.apply(event));
      this.releaseCursors = this.cursors.activate();
      return;
    }

    if (!this.demand.isActive) this.disconnect();
  }

  private disconnect(): void {
    // Releasing SharedCursorStore first retracts our presence and room lease.
    this.releaseCursors?.();
    this.releaseCursors = null;
    this.releasePresence?.();
    this.releasePresence = null;
    this.releasePool?.();
    this.releasePool = null;
    this.field.reset();
    this.cursorBuffer.clear();
  }
}
