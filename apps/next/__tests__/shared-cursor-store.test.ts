import { describe, expect, it } from "vitest";
import {
  SharedCursorStore,
  worldProjection,
  type SharedCursorStoreOptions,
} from "@/stores/userApp/sharedCursorStore";
import type { PresenceParticipant } from "@/lib/realtime/presence-room";
import type { PublishOptions, RealtimeTransport } from "@/lib/realtime-manager";

const ada: PresenceParticipant = { id: "ada", name: "Ada", tone: "lime" };
const maya: PresenceParticipant = { id: "maya", name: "Maya", tone: "cyan" };

class FakeTransport implements RealtimeTransport {
  readonly published: Array<{
    eventType: string;
    event: unknown;
    options?: PublishOptions;
  }> = [];

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

  dropLatest(): void {}

  joinRoom(): () => void {
    return () => undefined;
  }

  deliver(eventType: string, event: unknown): void {
    this.listeners.get(eventType)?.forEach((listener) => listener(event));
  }

  lastState(): unknown {
    const last = this.published.filter(
      (call) => call.eventType === "presence:set",
    );
    return (last.at(-1)?.event as { state: unknown } | undefined)?.state;
  }
}

interface Harness {
  transport: FakeTransport;
  store: SharedCursorStore;
  runTimers: () => void;
  pendingTimers: () => number;
}

function harness(
  roomId = "cursors:demo",
  options: SharedCursorStoreOptions = {},
): Harness {
  const transport = new FakeTransport();
  let timers: Array<() => void> = [];

  const store = new SharedCursorStore(transport, roomId, {
    idleAfterMs: 10_000,
    setTimer: (callback) => {
      timers.push(callback);
      return timers.length;
    },
    clearTimer: (handle) => {
      timers[(handle as number) - 1] = () => undefined;
    },
    ...options,
  });

  return {
    transport,
    store,
    runTimers: () => {
      const due = timers;
      timers = [];
      due.forEach((callback) => callback());
    },
    pendingTimers: () => timers.length,
  };
}

describe("SharedCursorStore", () => {
  it("uses the room id it was given", () => {
    expect(harness().store.roomId).toBe("cursors:demo");
    expect(harness("canvas:world").store.roomId).toBe("canvas:world");
  });

  it("ignores pointer movement before an identity is set", () => {
    const { transport, store } = harness();
    store.activate();

    store.setPointer(0.5, 0.5);

    expect(transport.published).toEqual([]);
  });

  it("publishes throttled, clamped coordinates", () => {
    const { transport, store } = harness();
    store.activate();
    store.setParticipant(ada);

    store.setPointer(1.4, -0.3);

    expect(transport.lastState()).toEqual({ x: 1, y: 0 });
    expect(transport.published.at(-1)?.options).toEqual({
      latestKey: "presence:cursors:demo",
      throttleMs: 33,
    });
  });

  it("excludes the local cursor from what it renders", () => {
    const { transport, store } = harness();
    store.activate();
    store.setParticipant(ada);
    store.setPointer(0.2, 0.2);

    transport.deliver("presence", {
      type: "presence",
      roomId: "cursors:demo",
      action: "upsert",
      entry: { participant: maya, state: { x: 0.7, y: 0.4 } },
    });

    expect(store.cursors).toEqual([
      { participant: maya, state: { x: 0.7, y: 0.4 } },
    ]);
  });

  it("keeps pointerless participants in the roster but out of the cursors", () => {
    const { transport, store } = harness("canvas:world");
    store.activate();
    store.setParticipant(ada);

    // A touch client: present in the room, publishing no pointer at all.
    transport.deliver("presence", {
      type: "presence",
      roomId: "canvas:world",
      action: "upsert",
      entry: { participant: maya, state: null },
    });

    expect(store.cursors).toEqual([]);
    expect(store.participants).toEqual(
      expect.arrayContaining([ada, maya]),
    );
    expect(store.participants).toHaveLength(2);
    expect(store.hasPointer(maya.id)).toBe(false);
    expect(store.hasPointer(ada.id)).toBe(false);

    store.setPointer(0.5, 0.5);
    expect(store.hasPointer(ada.id)).toBe(true);
  });

  it("reports the local participant so the facepile can mark it", () => {
    const { store } = harness("canvas:world");
    store.activate();

    expect(store.selfParticipant).toBeNull();
    store.setParticipant(ada);
    expect(store.selfParticipant).toEqual(ada);
  });

  it("labels a ripple from a client that had no pointer", () => {
    const { transport, store } = harness("canvas:world");
    store.activate();
    store.setParticipant(ada);

    transport.deliver("presence", {
      type: "presence",
      roomId: "canvas:world",
      action: "upsert",
      entry: { participant: maya, state: null },
    });
    transport.deliver("signal", {
      type: "signal",
      roomId: "canvas:world",
      kind: "ripple",
      participant: maya,
      data: { x: 100, y: 100 },
    });

    expect(store.ripples[0].hadPointer).toBe(false);
  });

  it("leaves a ripple unlabelled when its sender already shows a cursor", () => {
    const { transport, store } = harness("canvas:world");
    store.activate();
    store.setParticipant(ada);

    transport.deliver("presence", {
      type: "presence",
      roomId: "canvas:world",
      action: "upsert",
      entry: { participant: maya, state: { x: 10, y: 10 } },
    });
    transport.deliver("signal", {
      type: "signal",
      roomId: "canvas:world",
      kind: "ripple",
      participant: maya,
      data: { x: 100, y: 100 },
    });

    expect(store.ripples[0].hadPointer).toBe(true);
  });

  it("hides a peer that is present but has no position", () => {
    const { transport, store } = harness();
    store.activate();
    store.setParticipant(ada);

    transport.deliver("presence", {
      type: "presence",
      roomId: "cursors:demo",
      action: "upsert",
      entry: { participant: maya, state: null },
    });

    expect(store.cursors).toEqual([]);
  });

  it("retires a pointer that stops moving", () => {
    const { transport, store, runTimers } = harness();
    store.activate();
    store.setParticipant(ada);
    store.setPointer(0.5, 0.5);

    expect(transport.lastState()).toEqual({ x: 0.5, y: 0.5 });

    runTimers();

    expect(transport.lastState()).toBeNull();
  });

  it("keeps the pointer alive while it is still moving", () => {
    const { transport, store, runTimers, pendingTimers } = harness();
    store.activate();
    store.setParticipant(ada);

    store.setPointer(0.1, 0.1);
    store.setPointer(0.2, 0.2);
    store.setPointer(0.3, 0.3);

    // Each move cancels the previous deadline rather than stacking one.
    expect(pendingTimers()).toBe(3);
    runTimers();
    expect(transport.lastState()).toBeNull();
    expect(
      transport.published.filter((call) => call.eventType === "presence:set"),
    ).toHaveLength(5); // identity + three moves + the idle retirement
  });

  it("projects surface fractions into world units for a canvas room", () => {
    const { transport, store } = harness("canvas:world", {
      projection: worldProjection(1600, 1000),
    });
    store.activate();
    store.setParticipant(ada);

    store.setPointer(0.5, 0.25);
    expect(transport.lastState()).toEqual({ x: 800, y: 250 });

    // The same fraction is the same world point no matter which client
    // reported it, which is the whole reason for the projection.
    store.setPointer(1, 1);
    expect(transport.lastState()).toEqual({ x: 1600, y: 1000 });
  });

  it("clamps a projected point to the edge of the world", () => {
    const { transport, store } = harness("canvas:world", {
      projection: worldProjection(1600, 1000),
    });
    store.activate();
    store.setParticipant(ada);

    store.setPointer(1.4, -0.2);

    expect(transport.lastState()).toEqual({ x: 1600, y: 0 });
  });

  it("draws a local ripple immediately and broadcasts it in world units", () => {
    const { transport, store } = harness("canvas:world", {
      projection: worldProjection(1600, 1000),
    });
    store.activate();
    store.setParticipant(ada);

    store.emitTap(0.5, 0.25);

    // Local echo: the tapper must not wait on a round trip.
    expect(store.ripples).toHaveLength(1);
    expect(store.ripples[0].point).toEqual({ x: 800, y: 250 });
    expect(store.ripples[0].participant).toEqual(ada);

    expect(
      transport.published.filter((call) => call.eventType === "room:signal"),
    ).toEqual([
      {
        eventType: "room:signal",
        event: {
          roomId: "canvas:world",
          kind: "ripple",
          participant: ada,
          data: { x: 800, y: 250 },
        },
        options: undefined,
      },
    ]);
  });

  it("retires each ripple independently", () => {
    const { store, runTimers } = harness("canvas:world");
    store.activate();
    store.setParticipant(ada);

    store.emitTap(0.1, 0.1);
    store.emitTap(0.9, 0.9);
    expect(store.ripples).toHaveLength(2);

    runTimers();
    expect(store.ripples).toHaveLength(0);
  });

  it("gives repeated taps at one point distinct identities", () => {
    const { store } = harness("canvas:world");
    store.activate();
    store.setParticipant(ada);

    store.emitTap(0.5, 0.5);
    store.emitTap(0.5, 0.5);

    const [first, second] = store.ripples;
    expect(first.id).not.toBe(second.id);
  });

  it("draws ripples arriving from peers", () => {
    const { transport, store } = harness("canvas:world");
    store.activate();
    store.setParticipant(ada);

    transport.deliver("signal", {
      type: "signal",
      roomId: "canvas:world",
      kind: "ripple",
      participant: maya,
      data: { x: 120, y: 340 },
    });

    expect(store.ripples).toHaveLength(1);
    expect(store.ripples[0].participant).toEqual(maya);
    expect(store.ripples[0].point).toEqual({ x: 120, y: 340 });
  });

  it("ignores signals of other kinds", () => {
    const { transport, store } = harness("canvas:world");
    store.activate();
    store.setParticipant(ada);

    transport.deliver("signal", {
      type: "signal",
      roomId: "canvas:world",
      kind: "confetti",
      participant: maya,
      data: { x: 120, y: 340 },
    });

    expect(store.ripples).toHaveLength(0);
  });

  it("ignores a tap before an identity is set", () => {
    const { transport, store } = harness("canvas:world");
    store.activate();

    store.emitTap(0.5, 0.5);

    expect(store.ripples).toHaveLength(0);
    expect(transport.published).toEqual([]);
  });

  it("clears the pointer and cancels the idle deadline on leave", () => {
    const { transport, store, runTimers } = harness();
    store.activate();
    store.setParticipant(ada);
    store.setPointer(0.5, 0.5);

    store.clearPointer();
    expect(transport.lastState()).toBeNull();

    const publishedBefore = transport.published.length;
    runTimers();
    expect(transport.published).toHaveLength(publishedBefore);
  });
});
