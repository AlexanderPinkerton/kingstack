import {
  POOL_CELL_COUNT,
  POOL_GRID,
  POOL_PROTOCOL_VERSION,
  POOL_ROOM_ID,
} from "@kingstack/shared";
import { describe, expect, it } from "vitest";
import type { PublishOptions, RealtimeTransport } from "@/lib/realtime-manager";
import type { PresenceParticipant } from "@/lib/realtime/presence-room";
import { WavePoolStore } from "@/stores/userApp/wavePoolStore";

const ada: PresenceParticipant = { id: "ada", name: "Ada", tone: "lime" };

class FakeTransport implements RealtimeTransport {
  readonly activity: string[] = [];
  readonly published: Array<{ eventType: string; event: unknown }> = [];
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  subscribe<TEvent>(
    eventType: string,
    listener: (event: TEvent) => void,
  ): () => void {
    this.activity.push(`subscribe:${eventType}`);
    const typed = listener as (event: unknown) => void;
    const listeners = this.listeners.get(eventType) ?? new Set();
    listeners.add(typed);
    this.listeners.set(eventType, listeners);
    return () => {
      this.activity.push(`unsubscribe:${eventType}`);
      listeners.delete(typed);
    };
  }

  publish<TEvent>(
    eventType: string,
    event: TEvent,
    _options?: PublishOptions,
  ): void {
    this.published.push({ eventType, event });
  }

  dropLatest(): void {}

  joinRoom(roomId: string): () => void {
    this.activity.push(`join:${roomId}`);
    return () => this.activity.push(`leave:${roomId}`);
  }

  deliver(eventType: string, event: unknown): void {
    this.listeners.get(eventType)?.forEach((listener) => listener(event));
  }
}

describe("WavePoolStore", () => {
  it("subscribes before joining and ref-counts the global room", () => {
    const transport = new FakeTransport();
    const store = new WavePoolStore(transport);

    const releaseFirst = store.activate();
    const releaseSecond = store.activate();

    expect(transport.activity.slice(0, 5)).toEqual([
      "subscribe:pool",
      "subscribe:presence",
      "subscribe:presence",
      "subscribe:signal",
      `join:${POOL_ROOM_ID}`,
    ]);
    expect(
      transport.activity.filter((value) => value.startsWith("join:")),
    ).toHaveLength(1);

    releaseFirst();
    expect(transport.activity).not.toContain(`leave:${POOL_ROOM_ID}`);
    releaseSecond();
    expect(transport.activity).toContain(`leave:${POOL_ROOM_ID}`);
    expect(store.field.epoch).toBeNull();
    store.dispose();
  });

  it("applies pool frames and projects raw presence into its cursor buffer", () => {
    const transport = new FakeTransport();
    const store = new WavePoolStore(transport);
    const release = store.activate();
    store.setParticipant(ada);

    const data = new Int8Array(POOL_CELL_COUNT);
    data.fill(8);
    transport.deliver("pool", {
      type: "pool",
      version: POOL_PROTOCOL_VERSION,
      roomId: POOL_ROOM_ID,
      action: "keyframe",
      epoch: "test",
      seq: 0,
      grid: POOL_GRID,
      data,
    });
    transport.deliver("presence", {
      type: "presence",
      roomId: POOL_ROOM_ID,
      action: "upsert",
      entry: {
        participant: { id: "maya", name: "Maya", tone: "cyan" },
        state: { x: 25, y: 40 },
      },
    });

    expect(store.field.current[0]).toBe(8);
    expect(store.cursorBuffer.count).toBe(1);
    expect(Array.from(store.cursorBuffer.positions.slice(0, 2))).toEqual([
      25, 40,
    ]);
    expect(
      store.cursors.participants.map((participant) => participant.id),
    ).toEqual(expect.arrayContaining(["ada", "maya"]));

    release();
    store.dispose();
  });

  it("publishes clamped pool-world coordinates with one identity", () => {
    const transport = new FakeTransport();
    const store = new WavePoolStore(transport);
    const release = store.activate();
    store.setParticipant(ada);
    store.setPointer(2_000, -10);

    const publication = transport.published
      .filter((call) => call.eventType === "presence:set")
      .at(-1)?.event as { state: unknown };
    expect(publication.state).toEqual({ x: 1600, y: 0 });
    expect(store.cursorBuffer.count).toBe(0);

    store.emitTap(100, 200);
    expect(store.cursors.ripples).toHaveLength(0);
    expect(
      transport.published.some((call) => call.eventType === "room:signal"),
    ).toBe(true);

    release();
    store.dispose();
  });
});
