import type { PoolViewpoint } from "@kingstack/shared";
import { browserLogger } from "@/lib/browser-logger";
import { BoatBuffer } from "@/lib/pool/boat-buffer";
import { CursorBuffer } from "@/lib/pool/cursor-buffer";
import { PoolField } from "@/lib/pool/pool-field";
import { ViewpointBuffer } from "@/lib/pool/viewpoint-buffer";
import type { RealtimeTransport } from "@/lib/realtime-manager";
import type {
  PresenceParticipant,
  PresenceServerEvent,
} from "@/lib/realtime/presence-room";
import { StoreDemand } from "@/lib/store-lifecycle";
import { PoolBoatResetStore } from "./poolBoatResetStore";
import { PoolPresenceStore } from "./poolPresenceStore";

const logger = browserLogger.child({ component: "WavePoolStore" });

/** Owns the one global pool's field, pointer stream, and room lease. */
export class WavePoolStore {
  readonly field = new PoolField();
  readonly boat = new BoatBuffer();
  readonly cursorBuffer = new CursorBuffer();
  readonly viewpointBuffer = new ViewpointBuffer();
  readonly boatReset = new PoolBoatResetStore();
  readonly cursors: PoolPresenceStore;

  private readonly demand: StoreDemand;
  private releasePool: (() => void) | null = null;
  private releaseBoat: (() => void) | null = null;
  private releasePresence: (() => void) | null = null;
  private releaseCursors: (() => void) | null = null;
  private disposed = false;

  constructor(private readonly transport: RealtimeTransport) {
    this.cursors = new PoolPresenceStore(transport);
    this.demand = new StoreDemand(() => this.syncDemand());
  }

  activate(): () => void {
    return this.demand.activate();
  }

  setParticipant(participant: PresenceParticipant): void {
    this.cursorBuffer.setSelfParticipantId(participant.id);
    this.viewpointBuffer.setSelfParticipantId(participant.id);
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

  setViewpoint(viewpoint: PoolViewpoint): void {
    this.cursors.setViewpoint(viewpoint);
  }

  resetBoat(): void {
    if (!this.boatReset.beginRequest()) return;
    if (!this.cursors.emitBoatReset()) this.boatReset.cancelPending();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disconnect();
    this.demand.dispose();
    this.cursors.dispose();
    this.boatReset.dispose();
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
      this.releaseBoat = this.transport.subscribe<unknown>(
        "pool:boat",
        (event) => {
          if (!this.boat.apply(event) || !this.boat.epoch) return;
          this.boatReset.observeFrame(
            this.boat.epoch,
            this.boat.resetSeq,
            this.boat.resetCooldownMs,
          );
        },
      );
      this.releasePresence = this.transport.subscribe<
        PresenceServerEvent<unknown>
      >("presence", (event) => {
        this.cursorBuffer.apply(event);
        this.viewpointBuffer.apply(event);
      });
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
    this.releaseBoat?.();
    this.releaseBoat = null;
    this.releasePool?.();
    this.releasePool = null;
    this.field.reset();
    this.boat.reset();
    this.boatReset.reset();
    this.cursorBuffer.clear();
    this.viewpointBuffer.clear();
  }
}
