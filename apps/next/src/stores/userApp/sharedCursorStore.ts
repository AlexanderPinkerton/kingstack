// Multiplayer pointer presence.
//
// This is the purely ephemeral half of the realtime story: nothing here touches
// Postgres or the AOS query cache. Positions live only in the room while the
// participant is connected, which is why a cursor can be published at pointer
// rate without any write amplification on the database.

import { computed, makeObservable } from "mobx";
import type { RealtimeTransport } from "@/lib/realtime-manager";
import {
  PresenceRoom,
  type PresenceEntry,
  type PresenceParticipant,
} from "@/lib/realtime/presence-room";

/** Fractions of the shared surface, so clients with different viewports agree. */
export interface CursorState {
  x: number;
  y: number;
}

export type CursorEntry = PresenceEntry<CursorState> & { state: CursorState };

/** ~30Hz. Fast enough to read as continuous motion, slow enough to be cheap. */
const DEFAULT_THROTTLE_MS = 33;

/**
 * A pointer that stops moving is usually a pointer that left the window without
 * firing `pointerleave` (tab switch, drag onto browser chrome). Retiring it
 * keeps abandoned cursors from pinning themselves to the surface.
 */
const DEFAULT_IDLE_AFTER_MS = 10_000;

export interface SharedCursorStoreOptions {
  throttleMs?: number;
  idleAfterMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class SharedCursorStore {
  private readonly room: PresenceRoom<CursorState>;
  private readonly idleAfterMs: number;
  private readonly setTimer: (callback: () => void, delayMs: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private participant: PresenceParticipant | null = null;
  private idleHandle: unknown = null;

  constructor(
    transport: RealtimeTransport,
    /** Room scope, e.g. `realtime-demo`. Combined into `cursors:<scope>`. */
    scope: string,
    options: SharedCursorStoreOptions = {},
  ) {
    this.room = new PresenceRoom<CursorState>(transport, `cursors:${scope}`, {
      throttleMs: options.throttleMs ?? DEFAULT_THROTTLE_MS,
    });
    this.idleAfterMs = options.idleAfterMs ?? DEFAULT_IDLE_AFTER_MS;
    this.setTimer =
      options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearTimer =
      options.clearTimer ??
      ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

    makeObservable(this, { cursors: computed });
  }

  get roomId(): string {
    return this.room.roomId;
  }

  activate(): () => void {
    return this.room.activate();
  }

  dispose(): void {
    this.stopIdleTimer();
    this.room.dispose();
  }

  /** Other people's pointers. The local pointer is drawn by the OS, not by us. */
  get cursors(): CursorEntry[] {
    return this.room.peersWhere((state) => state !== null) as CursorEntry[];
  }

  setParticipant(participant: PresenceParticipant): void {
    this.participant = participant;
    // An identity change mid-session (a rename) must reach peers even if the
    // pointer never moves again.
    this.room.setSelf(participant, null);
  }

  /** Coordinates are fractions of the surface and are clamped to it. */
  setPointer(x: number, y: number): void {
    if (!this.participant) return;

    this.room.setSelf(this.participant, {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    });
    this.restartIdleTimer();
  }

  /** The pointer left the surface: stay in the room, stop being drawn. */
  clearPointer(): void {
    this.stopIdleTimer();
    if (!this.participant) return;
    this.room.setSelf(this.participant, null);
  }

  private restartIdleTimer(): void {
    this.stopIdleTimer();
    this.idleHandle = this.setTimer(() => {
      this.idleHandle = null;
      this.clearPointer();
    }, this.idleAfterMs);
  }

  private stopIdleTimer(): void {
    if (this.idleHandle === null) return;
    this.clearTimer(this.idleHandle);
    this.idleHandle = null;
  }
}
