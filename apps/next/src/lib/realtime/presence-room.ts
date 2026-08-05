// Reusable client half of the room presence protocol.
//
// One instance tracks who else is in a room and where they are. It is generic
// over the feature-specific `state` payload, so a checkbox grid, a cursor
// surface, and a comment thread all share this code and differ only in the
// shape they put on the wire.
//
// Pure MobX with no React dependency: components observe `entries` and never
// drive the transport themselves.

import { observable, runInAction } from "mobx";
import type { PublishOptions, RealtimeTransport } from "@/lib/realtime-manager";
import { StoreDemand } from "@/lib/store-lifecycle";

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

export interface PresenceEntry<TState> {
  participant: PresenceParticipant;
  /** `null` means present in the room but not pointing at anything. */
  state: TState | null;
}

export type PresenceServerEvent<TState> = {
  type?: string;
  roomId?: string;
  action?: "sync" | "upsert" | "remove";
  entries?: PresenceEntry<TState>[];
  entry?: PresenceEntry<TState>;
  participantId?: string;
};

export type DecodedPresence<TState> =
  | { operation: "sync"; entries: PresenceEntry<TState>[] }
  | { operation: "upsert"; entry: PresenceEntry<TState> }
  | { operation: "remove"; participantId: string };

/**
 * A presence identity is per tab, not per user: two tabs belonging to one
 * person are two independent cursors and must not overwrite each other.
 */
export function createParticipantId(prefix = "participant"): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

/**
 * Deterministic tone for a participant, so the same person keeps the same
 * colour across reloads and looks identical to every other client.
 */
export function toneForParticipantId(participantId: string): PresenceTone {
  let hash = 0;
  for (let index = 0; index < participantId.length; index += 1) {
    hash = (hash * 31 + participantId.charCodeAt(index)) | 0;
  }
  return PRESENCE_TONES[Math.abs(hash) % PRESENCE_TONES.length];
}

function isParticipant(value: unknown): value is PresenceParticipant {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    typeof candidate.tone === "string" &&
    (PRESENCE_TONES as readonly string[]).includes(candidate.tone)
  );
}

function isEntry<TState>(value: unknown): value is PresenceEntry<TState> {
  if (typeof value !== "object" || value === null) return false;
  return isParticipant((value as Record<string, unknown>).participant);
}

/**
 * Turns a raw transport frame into a change to apply, or `null` when the frame
 * belongs to another room or fails validation. Exported for direct testing.
 */
export function decodePresenceEvent<TState>(
  roomId: string,
  event: PresenceServerEvent<TState>,
): DecodedPresence<TState> | null {
  if (event.type && event.type !== "presence") return null;
  if (event.roomId !== roomId) return null;

  if (event.action === "sync") {
    const entries = Array.isArray(event.entries) ? event.entries : [];
    return { operation: "sync", entries: entries.filter(isEntry<TState>) };
  }

  if (event.action === "upsert" && isEntry<TState>(event.entry)) {
    return { operation: "upsert", entry: event.entry };
  }

  if (
    event.action === "remove" &&
    typeof event.participantId === "string" &&
    event.participantId.length > 0
  ) {
    return { operation: "remove", participantId: event.participantId };
  }

  return null;
}

export interface PresenceRoomOptions {
  /**
   * Coalescing interval for outbound state. Leave unset for low-frequency
   * presence; set it for pointer-rate streams.
   */
  throttleMs?: number;
}

export class PresenceRoom<TState> {
  /** Everyone in the room, including this client once it publishes. */
  readonly entries = observable.map<string, PresenceEntry<TState>>();

  private readonly demand: StoreDemand;
  private readonly throttleMs: number;
  private releaseRoom: (() => void) | null = null;
  private releaseSubscription: (() => void) | null = null;
  private self: PresenceParticipant | null = null;
  private selfState: TState | null = null;

  constructor(
    private readonly transport: RealtimeTransport,
    readonly roomId: string,
    options: PresenceRoomOptions = {},
  ) {
    this.throttleMs = options.throttleMs ?? 0;
    this.demand = new StoreDemand(() => this.syncSubscription());
  }

  /** Ref-counted; the room is joined while at least one consumer holds it. */
  activate(): () => void {
    return this.demand.activate();
  }

  dispose(): void {
    this.leave();
    this.demand.dispose();
  }

  // ---------- Reads ----------

  get participants(): PresenceParticipant[] {
    return Array.from(this.entries.values()).map((entry) => entry.participant);
  }

  /** Everyone except the local participant, which the UI usually draws itself. */
  peers(): PresenceEntry<TState>[] {
    return Array.from(this.entries.values()).filter(
      (entry) => entry.participant.id !== this.self?.id,
    );
  }

  peersWhere(
    predicate: (state: TState | null) => boolean,
  ): PresenceEntry<TState>[] {
    return this.peers().filter((entry) => predicate(entry.state));
  }

  // ---------- Writes ----------

  /**
   * Publishes this client's position. Applied locally first so the local UI
   * never waits on a round trip; the server echoes only to peers.
   */
  setSelf(participant: PresenceParticipant, state: TState | null): void {
    this.self = participant;
    this.selfState = state;

    runInAction(() => {
      this.entries.set(participant.id, { participant, state });
    });

    this.transport.publish(
      "presence:set",
      { roomId: this.roomId, participant, state },
      this.publishOptions(),
    );
  }

  /** Stays in the room but stops pointing at anything. */
  clearSelfState(): void {
    if (!this.self) return;
    this.setSelf(this.self, null);
  }

  /** Removes this client from the room roster without leaving the room. */
  clearSelf(): void {
    const participant = this.self;
    if (!participant) return;

    this.self = null;
    this.selfState = null;
    runInAction(() => {
      this.entries.delete(participant.id);
    });

    this.transport.publish("presence:clear", { roomId: this.roomId });
  }

  private get latestKey(): string {
    // Keyed per room so two rooms sharing one socket do not overwrite each
    // other's reconnect state.
    return `presence:${this.roomId}`;
  }

  private publishOptions(): PublishOptions {
    return { latestKey: this.latestKey, throttleMs: this.throttleMs };
  }

  /**
   * Releases the room. The server retracts our presence on `room:leave`, so no
   * explicit clear is sent; the local identity is kept so a remount can
   * re-announce it.
   */
  private leave(): void {
    this.transport.dropLatest(this.latestKey);
    this.releaseSubscription?.();
    this.releaseSubscription = null;
    this.releaseRoom?.();
    this.releaseRoom = null;
    runInAction(() => this.entries.clear());
  }

  private syncSubscription(): void {
    const shouldJoin = this.demand.isActive;

    if (shouldJoin && !this.releaseRoom) {
      this.releaseSubscription = this.transport.subscribe<
        PresenceServerEvent<TState>
      >("presence", (event) => this.applyEvent(event));
      this.releaseRoom = this.transport.joinRoom(this.roomId);

      // Re-announce after a remount so peers that missed the gap see us again.
      if (this.self) {
        this.setSelf(this.self, this.selfState);
      }
      return;
    }

    if (!shouldJoin && this.releaseRoom) {
      this.leave();
    }
  }

  private applyEvent(event: PresenceServerEvent<TState>): void {
    const change = decodePresenceEvent<TState>(this.roomId, event);
    if (!change) return;

    runInAction(() => {
      if (change.operation === "sync") {
        // A sync is authoritative for peers only; the local entry is owned by
        // this client and would otherwise vanish on every reconnect.
        const selfEntry = this.self ? this.entries.get(this.self.id) : undefined;
        this.entries.clear();
        change.entries.forEach((entry) => {
          this.entries.set(entry.participant.id, entry);
        });
        if (this.self && selfEntry) {
          this.entries.set(this.self.id, selfEntry);
        }
        return;
      }

      if (change.operation === "remove") {
        if (change.participantId === this.self?.id) return;
        this.entries.delete(change.participantId);
        return;
      }

      if (change.entry.participant.id === this.self?.id) return;
      this.entries.set(change.entry.participant.id, change.entry);
    });
  }
}
