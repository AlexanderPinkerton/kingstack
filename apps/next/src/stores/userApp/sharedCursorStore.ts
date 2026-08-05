// Multiplayer pointer presence.
//
// This is the purely ephemeral half of the realtime story: nothing here touches
// Postgres or the AOS query cache. Positions live only in the room while the
// participant is connected, which is why a cursor can be published at pointer
// rate without any write amplification on the database.

import { computed, makeObservable, observable, runInAction } from "mobx";
import type { RealtimeTransport } from "@/lib/realtime-manager";
import {
  PresenceRoom,
  type PresenceEntry,
  type PresenceParticipant,
} from "@/lib/realtime/presence-room";

/**
 * A point in whatever space the room publishes. Two spaces are in use:
 *
 * - fractions of the bound surface (`cursors:*`), which only agree between
 *   clients that render the same layout inside that surface;
 * - absolute world units (`canvas:*`), which agree between any two clients
 *   because the world's size is fixed and independent of the viewport.
 */
export interface CursorState {
  x: number;
  y: number;
}

/** Maps a surface fraction to the coordinate space the room publishes. */
export type CursorProjection = (x: number, y: number) => CursorState;

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, value));
}

/** Default space: the fraction of the surface, clamped to it. */
export const SURFACE_FRACTION_PROJECTION: CursorProjection = (x, y) => ({
  x: clamp(x, 1),
  y: clamp(y, 1),
});

/** Scales a surface fraction onto a fixed world of the given size. */
export function worldProjection(
  worldWidth: number,
  worldHeight: number,
): CursorProjection {
  return (x, y) => ({
    x: clamp(x * worldWidth, worldWidth),
    y: clamp(y * worldHeight, worldHeight),
  });
}

export type CursorEntry = PresenceEntry<CursorState> & { state: CursorState };

export const RIPPLE_SIGNAL_KIND = "ripple";

/**
 * A tap someone made, in the room's coordinate space. Touch clients publish no
 * pointer at all, so this is the only trace they leave on a shared surface.
 */
export interface Ripple {
  id: string;
  participant: PresenceParticipant;
  point: CursorState;
  /**
   * Whether the sender was publishing a cursor when they tapped. A touch client
   * never is, so this distinguishes a tap that already has a labelled cursor on
   * screen from one that arrives with nothing to identify it.
   */
  hadPointer: boolean;
}

/** Long enough to read as a deliberate mark, short enough not to accumulate. */
const DEFAULT_RIPPLE_LIFETIME_MS = 1_200;

/** ~30Hz. Fast enough to read as continuous motion, slow enough to be cheap. */
const DEFAULT_THROTTLE_MS = 33;

/**
 * A pointer that stops moving is usually a pointer that left the window without
 * firing `pointerleave` (tab switch, drag onto browser chrome). Retiring it
 * keeps abandoned cursors from pinning themselves to the surface.
 */
const DEFAULT_IDLE_AFTER_MS = 10_000;

export interface SharedCursorStoreOptions {
  /** Defaults to surface fractions; pass `worldProjection` for a fixed scene. */
  projection?: CursorProjection;
  throttleMs?: number;
  idleAfterMs?: number;
  rippleLifetimeMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class SharedCursorStore {
  /** Active taps, newest last. Entries retire themselves. */
  readonly ripples = observable.array<Ripple>([], { deep: false });

  private readonly room: PresenceRoom<CursorState>;
  private readonly projection: CursorProjection;
  private readonly idleAfterMs: number;
  private readonly rippleLifetimeMs: number;
  private readonly setTimer: (callback: () => void, delayMs: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly rippleHandles = new Set<unknown>();
  private releaseSignals: (() => void) | null = null;
  private participant: PresenceParticipant | null = null;
  private idleHandle: unknown = null;
  private rippleSequence = 0;

  constructor(
    transport: RealtimeTransport,
    /** Full room id, e.g. `cursors:realtime-demo` or `canvas:world`. */
    roomId: string,
    options: SharedCursorStoreOptions = {},
  ) {
    this.room = new PresenceRoom<CursorState>(transport, roomId, {
      throttleMs: options.throttleMs ?? DEFAULT_THROTTLE_MS,
    });
    this.projection = options.projection ?? SURFACE_FRACTION_PROJECTION;
    this.idleAfterMs = options.idleAfterMs ?? DEFAULT_IDLE_AFTER_MS;
    this.rippleLifetimeMs =
      options.rippleLifetimeMs ?? DEFAULT_RIPPLE_LIFETIME_MS;
    this.setTimer =
      options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearTimer =
      options.clearTimer ??
      ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

    makeObservable(this, { cursors: computed, participants: computed });
  }

  get roomId(): string {
    return this.room.roomId;
  }

  activate(): () => void {
    this.releaseSignals ??= this.room.onSignal<CursorState>((signal) => {
      if (signal.kind !== RIPPLE_SIGNAL_KIND) return;
      this.addRipple(signal.participant, signal.data);
    });
    return this.room.activate();
  }

  dispose(): void {
    this.stopIdleTimer();
    this.clearRipples();
    this.releaseSignals?.();
    this.releaseSignals = null;
    this.room.dispose();
  }

  /** Other people's pointers. The local pointer is drawn by the OS, not by us. */
  get cursors(): CursorEntry[] {
    return this.room.peersWhere((state) => state !== null) as CursorEntry[];
  }

  /**
   * Everyone in the room, including this client and anyone publishing no
   * pointer at all. A touch client is present and can tap; it simply has no
   * hover to sample, so it never appears in `cursors`.
   */
  get participants(): PresenceParticipant[] {
    return this.room.participants;
  }

  get selfParticipant(): PresenceParticipant | null {
    return this.room.selfParticipant;
  }

  hasPointer(participantId: string): boolean {
    return this.room.stateOf(participantId) !== null;
  }

  setParticipant(participant: PresenceParticipant): void {
    this.participant = participant;
    // An identity change mid-session (a rename) must reach peers even if the
    // pointer never moves again.
    this.room.setSelf(participant, null);
  }

  /**
   * Takes a fraction of the bound surface, as reported by the surface
   * controller, and publishes it in this room's coordinate space.
   */
  setPointer(x: number, y: number): void {
    if (!this.participant) return;

    this.room.setSelf(this.participant, this.projection(x, y));
    this.restartIdleTimer();
  }

  /**
   * Records a tap. Drawn locally at once and broadcast to peers, so a touch
   * client that publishes no pointer is still visible on the surface.
   */
  emitTap(x: number, y: number): void {
    if (!this.participant) return;

    const point = this.projection(x, y);
    this.addRipple(this.participant, point);
    this.room.sendSignal(RIPPLE_SIGNAL_KIND, point);
  }

  /** The pointer left the surface: stay in the room, stop being drawn. */
  clearPointer(): void {
    this.stopIdleTimer();
    if (!this.participant) return;
    this.room.setSelf(this.participant, null);
  }

  private addRipple(participant: PresenceParticipant, point: CursorState): void {
    this.rippleSequence += 1;
    const ripple: Ripple = {
      id: `${participant.id}-${this.rippleSequence}`,
      participant,
      point,
      // Captured now rather than read at render time, so a cursor arriving
      // mid-animation cannot make the label flicker away.
      hadPointer: this.hasPointer(participant.id),
    };

    runInAction(() => this.ripples.push(ripple));

    const handle = this.setTimer(() => {
      this.rippleHandles.delete(handle);
      runInAction(() => this.ripples.remove(ripple));
    }, this.rippleLifetimeMs);
    this.rippleHandles.add(handle);
  }

  private clearRipples(): void {
    this.rippleHandles.forEach((handle) => this.clearTimer(handle));
    this.rippleHandles.clear();
    runInAction(() => this.ripples.clear());
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
