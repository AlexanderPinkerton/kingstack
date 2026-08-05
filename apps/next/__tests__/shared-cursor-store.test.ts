import { describe, expect, it } from "vitest";
import { SharedCursorStore } from "@/stores/userApp/sharedCursorStore";
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

function harness(idleAfterMs = 10_000): Harness {
  const transport = new FakeTransport();
  let timers: Array<() => void> = [];

  const store = new SharedCursorStore(transport, "demo", {
    idleAfterMs,
    setTimer: (callback) => {
      timers.push(callback);
      return timers.length;
    },
    clearTimer: (handle) => {
      timers[(handle as number) - 1] = () => undefined;
    },
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
  it("scopes its room under the cursors namespace", () => {
    expect(harness().store.roomId).toBe("cursors:demo");
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
