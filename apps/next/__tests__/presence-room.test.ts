import { describe, expect, it } from "vitest";
import {
  PresenceRoom,
  decodePresenceEvent,
  type PresenceEntry,
  type PresenceParticipant,
} from "@/lib/realtime/presence-room";
import type { PublishOptions, RealtimeTransport } from "@/lib/realtime-manager";

interface CursorState {
  x: number;
  y: number;
}

const ROOM_ID = "cursors:demo";

const ada: PresenceParticipant = { id: "ada", name: "Ada", tone: "lime" };
const maya: PresenceParticipant = { id: "maya", name: "Maya", tone: "violet" };

class FakeTransport implements RealtimeTransport {
  readonly published: Array<{
    eventType: string;
    event: unknown;
    options?: PublishOptions;
  }> = [];
  readonly droppedKeys: string[] = [];
  readonly joinedRooms: string[] = [];
  readonly leftRooms: string[] = [];

  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  subscribe<TEvent>(
    eventType: string,
    listener: (event: TEvent) => void,
  ): () => void {
    const typed = listener as (event: unknown) => void;
    const set = this.listeners.get(eventType) ?? new Set();
    set.add(typed);
    this.listeners.set(eventType, set);
    return () => {
      this.listeners.get(eventType)?.delete(typed);
    };
  }

  publish<TEvent>(
    eventType: string,
    event: TEvent,
    options?: PublishOptions,
  ): void {
    this.published.push({ eventType, event, options });
  }

  dropLatest(latestKey: string): void {
    this.droppedKeys.push(latestKey);
  }

  joinRoom(roomId: string): () => void {
    this.joinedRooms.push(roomId);
    return () => {
      this.leftRooms.push(roomId);
    };
  }

  deliver(eventType: string, event: unknown): void {
    this.listeners.get(eventType)?.forEach((listener) => listener(event));
  }

  listenerCount(eventType: string): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }
}

function entry(
  participant: PresenceParticipant,
  state: CursorState | null,
): PresenceEntry<CursorState> {
  return { participant, state };
}

describe("decodePresenceEvent", () => {
  it("ignores frames addressed to another room", () => {
    expect(
      decodePresenceEvent<CursorState>(ROOM_ID, {
        type: "presence",
        roomId: "cursors:other",
        action: "upsert",
        entry: entry(maya, { x: 0, y: 0 }),
      }),
    ).toBeNull();
  });

  it("drops roster members that fail participant validation", () => {
    const decoded = decodePresenceEvent<CursorState>(ROOM_ID, {
      type: "presence",
      roomId: ROOM_ID,
      action: "sync",
      entries: [
        entry(maya, { x: 0.5, y: 0.5 }),
        { participant: { id: "", name: "", tone: "gold" } } as never,
      ],
    });

    expect(decoded).toEqual({
      operation: "sync",
      entries: [entry(maya, { x: 0.5, y: 0.5 })],
    });
  });

  it("rejects malformed upserts and removals", () => {
    expect(
      decodePresenceEvent<CursorState>(ROOM_ID, {
        type: "presence",
        roomId: ROOM_ID,
        action: "upsert",
      }),
    ).toBeNull();
    expect(
      decodePresenceEvent<CursorState>(ROOM_ID, {
        type: "presence",
        roomId: ROOM_ID,
        action: "remove",
        participantId: "",
      }),
    ).toBeNull();
  });
});

describe("PresenceRoom", () => {
  it("joins the room and subscribes only while a consumer holds it", () => {
    const transport = new FakeTransport();
    const room = new PresenceRoom<CursorState>(transport, ROOM_ID);

    expect(transport.joinedRooms).toEqual([]);

    const release = room.activate();
    expect(transport.joinedRooms).toEqual([ROOM_ID]);
    expect(transport.listenerCount("presence")).toBe(1);

    release();
    expect(transport.leftRooms).toEqual([ROOM_ID]);
    expect(transport.listenerCount("presence")).toBe(0);
    expect(transport.droppedKeys).toEqual([`presence:${ROOM_ID}`]);
  });

  it("applies local state immediately and publishes it with a room-scoped key", () => {
    const transport = new FakeTransport();
    const room = new PresenceRoom<CursorState>(transport, ROOM_ID, {
      throttleMs: 33,
    });
    room.activate();

    room.setSelf(ada, { x: 0.4, y: 0.6 });

    expect(room.entries.get("ada")).toEqual(entry(ada, { x: 0.4, y: 0.6 }));
    expect(transport.published.at(-1)).toEqual({
      eventType: "presence:set",
      event: { roomId: ROOM_ID, participant: ada, state: { x: 0.4, y: 0.6 } },
      options: { latestKey: `presence:${ROOM_ID}`, throttleMs: 33 },
    });
  });

  it("keeps the local entry when the server sends an authoritative roster", () => {
    const transport = new FakeTransport();
    const room = new PresenceRoom<CursorState>(transport, ROOM_ID);
    room.activate();
    room.setSelf(ada, { x: 0.1, y: 0.1 });

    transport.deliver("presence", {
      type: "presence",
      roomId: ROOM_ID,
      action: "sync",
      entries: [entry(maya, { x: 0.9, y: 0.9 })],
    });

    expect(room.entries.get("ada")).toEqual(entry(ada, { x: 0.1, y: 0.1 }));
    expect(room.entries.get("maya")).toEqual(entry(maya, { x: 0.9, y: 0.9 }));
    expect(room.peers()).toEqual([entry(maya, { x: 0.9, y: 0.9 })]);
  });

  it("ignores server echoes about the local participant", () => {
    const transport = new FakeTransport();
    const room = new PresenceRoom<CursorState>(transport, ROOM_ID);
    room.activate();
    room.setSelf(ada, { x: 0.1, y: 0.1 });

    transport.deliver("presence", {
      type: "presence",
      roomId: ROOM_ID,
      action: "upsert",
      entry: entry(ada, { x: 0.99, y: 0.99 }),
    });
    transport.deliver("presence", {
      type: "presence",
      roomId: ROOM_ID,
      action: "remove",
      participantId: "ada",
    });

    expect(room.entries.get("ada")).toEqual(entry(ada, { x: 0.1, y: 0.1 }));
  });

  it("removes a peer that left", () => {
    const transport = new FakeTransport();
    const room = new PresenceRoom<CursorState>(transport, ROOM_ID);
    room.activate();

    transport.deliver("presence", {
      type: "presence",
      roomId: ROOM_ID,
      action: "upsert",
      entry: entry(maya, { x: 0.5, y: 0.5 }),
    });
    expect(room.participants).toEqual([maya]);

    transport.deliver("presence", {
      type: "presence",
      roomId: ROOM_ID,
      action: "remove",
      participantId: "maya",
    });
    expect(room.participants).toEqual([]);
  });

  it("re-announces the local participant when demand returns", () => {
    const transport = new FakeTransport();
    const room = new PresenceRoom<CursorState>(transport, ROOM_ID);

    const release = room.activate();
    room.setSelf(ada, { x: 0.2, y: 0.2 });
    release();

    expect(room.entries.size).toBe(0);

    room.activate();
    expect(room.entries.get("ada")).toEqual(entry(ada, { x: 0.2, y: 0.2 }));
    expect(
      transport.published.filter((call) => call.eventType === "presence:set"),
    ).toHaveLength(2);
  });

  it("clearSelf removes the local entry and notifies the room once", () => {
    const transport = new FakeTransport();
    const room = new PresenceRoom<CursorState>(transport, ROOM_ID);
    room.activate();
    room.setSelf(ada, { x: 0.2, y: 0.2 });

    room.clearSelf();
    room.clearSelf();

    expect(room.entries.size).toBe(0);
    expect(
      transport.published.filter((call) => call.eventType === "presence:clear"),
    ).toEqual([
      { eventType: "presence:clear", event: { roomId: ROOM_ID }, options: undefined },
    ]);
  });

  it("filters peers by their state", () => {
    const transport = new FakeTransport();
    const room = new PresenceRoom<CursorState>(transport, ROOM_ID);
    room.activate();
    room.setSelf(ada, { x: 0, y: 0 });

    transport.deliver("presence", {
      type: "presence",
      roomId: ROOM_ID,
      action: "upsert",
      entry: entry(maya, { x: 0.8, y: 0.1 }),
    });

    expect(room.peersWhere((state) => (state?.x ?? 0) > 0.5)).toEqual([
      entry(maya, { x: 0.8, y: 0.1 }),
    ]);
    expect(room.peersWhere((state) => state === null)).toEqual([]);
  });

  it("does not throw when disposed twice", () => {
    const transport = new FakeTransport();
    const room = new PresenceRoom<CursorState>(transport, ROOM_ID);
    room.activate();

    expect(() => {
      room.dispose();
      room.dispose();
    }).not.toThrow();
    expect(transport.leftRooms).toEqual([ROOM_ID]);
  });
});
