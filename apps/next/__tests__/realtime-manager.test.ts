import { describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io-client";
import { RealtimeManager } from "@/lib/realtime-manager";

type Listener = (...args: any[]) => void;

class FakeSocket {
  connected = false;
  active = true;
  readonly emitted: Array<{ event: string; args: unknown[] }> = [];
  readonly disconnect = vi.fn(() => {
    this.connected = false;
    return this;
  });

  private readonly listeners = new Map<string, Set<Listener>>();

  on(eventType: string, listener: Listener): this {
    const listeners = this.listeners.get(eventType) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(eventType, listeners);
    return this;
  }

  off(eventType: string, listener: Listener): this {
    this.listeners.get(eventType)?.delete(listener);
    return this;
  }

  emit(eventType: string, ...args: unknown[]): this {
    this.emitted.push({ event: eventType, args });
    return this;
  }

  removeAllListeners(): this {
    this.listeners.clear();
    return this;
  }

  trigger(eventType: string, ...args: unknown[]): void {
    this.listeners.get(eventType)?.forEach((listener) => listener(...args));
  }

  listenerCount(eventType: string): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }

  asSocket(): Socket {
    return this as unknown as Socket;
  }
}

describe("RealtimeManager", () => {
  it("keeps channel subscriptions across connection setup and reconnects", () => {
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const socketFactory = vi
      .fn<() => Socket>()
      .mockReturnValueOnce(firstSocket.asSocket())
      .mockReturnValueOnce(secondSocket.asSocket());
    const manager = new RealtimeManager({
      browserId: "browser-a",
      socketFactory,
    });
    const listener = vi.fn();
    const unsubscribe = manager.subscribe("checkbox_update", listener);

    manager.setup("token-a");
    expect(firstSocket.listenerCount("checkbox_update")).toBe(1);
    firstSocket.connected = true;
    firstSocket.trigger("connect");

    expect(manager.status).toBe("connected");
    expect(manager.connected).toBe(true);
    expect(firstSocket.emitted).toContainEqual({
      event: "register",
      args: [{ token: "token-a", browserId: "browser-a" }],
    });

    firstSocket.trigger("checkbox_update", { id: "first" });
    expect(listener).toHaveBeenCalledWith({ id: "first" });

    manager.setup("token-b");
    expect(firstSocket.disconnect).toHaveBeenCalledOnce();
    expect(secondSocket.listenerCount("checkbox_update")).toBe(1);

    secondSocket.trigger("checkbox_update", { id: "second" });
    expect(listener).toHaveBeenLastCalledWith({ id: "second" });

    unsubscribe();
    expect(secondSocket.listenerCount("checkbox_update")).toBe(0);
  });

  it("does not recreate an active connection for the same token", () => {
    const socket = new FakeSocket();
    const socketFactory = vi.fn(() => socket.asSocket());
    const manager = new RealtimeManager({
      browserId: "browser-a",
      socketFactory,
    });

    manager.setup("token-a");
    manager.setup("token-a");

    expect(socketFactory).toHaveBeenCalledOnce();
  });

  it("replays the latest keyed publication after a reconnect", () => {
    const socket = new FakeSocket();
    const manager = new RealtimeManager({
      browserId: "browser-a",
      socketFactory: () => socket.asSocket(),
    });

    const presence = {
      roomId: "checkboxes:global",
      participant: { id: "a", name: "Ada", tone: "lime" },
      state: { checkboxIndex: 3 },
    };

    manager.setup("token-a");
    manager.publish("presence:set", presence, {
      latestKey: "presence:checkboxes:global",
    });
    expect(socket.emitted).not.toContainEqual(
      expect.objectContaining({ event: "presence:set" }),
    );

    socket.connected = true;
    socket.trigger("connect");

    expect(socket.emitted).toEqual([
      {
        event: "register",
        args: [{ token: "token-a", browserId: "browser-a" }],
      },
      { event: "presence:set", args: [presence] },
    ]);

    socket.connected = false;
    socket.trigger("disconnect", "transport close");
    socket.connected = true;
    socket.trigger("connect");

    expect(socket.emitted.slice(-2)).toEqual(socket.emitted.slice(0, 2));
  });

  it("stops replaying a dropped latest key", () => {
    const socket = new FakeSocket();
    const manager = new RealtimeManager({
      browserId: "browser-a",
      socketFactory: () => socket.asSocket(),
    });

    manager.setup("token-a");
    socket.connected = true;
    socket.trigger("connect");

    manager.publish("presence:set", { roomId: "cursors:demo" }, {
      latestKey: "presence:cursors:demo",
    });
    manager.dropLatest("presence:cursors:demo");

    socket.connected = false;
    socket.trigger("disconnect", "transport close");
    socket.connected = true;
    socket.trigger("connect");

    expect(
      socket.emitted
        .slice(-1)
        .filter((entry) => entry.event === "presence:set"),
    ).toEqual([]);
  });

  it("joins rooms once, re-joins them on reconnect, and leaves on last release", () => {
    const socket = new FakeSocket();
    const manager = new RealtimeManager({
      browserId: "browser-a",
      socketFactory: () => socket.asSocket(),
    });

    manager.setup("token-a");
    socket.connected = true;
    socket.trigger("connect");

    const releaseFirst = manager.joinRoom("checkboxes:global");
    const releaseSecond = manager.joinRoom("checkboxes:global");

    expect(
      socket.emitted.filter((entry) => entry.event === "room:join"),
    ).toEqual([{ event: "room:join", args: [{ roomId: "checkboxes:global" }] }]);

    socket.connected = false;
    socket.trigger("disconnect", "transport close");
    socket.connected = true;
    socket.trigger("connect");

    // Rooms are restored before any keyed presence so the server sees the join
    // first.
    const restored = socket.emitted.slice(-2).map((entry) => entry.event);
    expect(restored).toEqual(["register", "room:join"]);

    releaseFirst();
    expect(
      socket.emitted.filter((entry) => entry.event === "room:leave"),
    ).toEqual([]);

    releaseSecond();
    expect(
      socket.emitted.filter((entry) => entry.event === "room:leave"),
    ).toEqual([
      { event: "room:leave", args: [{ roomId: "checkboxes:global" }] },
    ]);
  });

  it("coalesces throttled publishes to one leading and one trailing frame", () => {
    const socket = new FakeSocket();
    let now = 0;
    const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
    const manager = new RealtimeManager({
      browserId: "browser-a",
      socketFactory: () => socket.asSocket(),
      now: () => now,
      scheduleFlush: (callback, delayMs) => {
        scheduled.push({ callback, delayMs });
        return scheduled.length;
      },
      cancelFlush: () => undefined,
    });

    manager.setup("token-a");
    socket.connected = true;
    socket.trigger("connect");

    const publishAt = (x: number) =>
      manager.publish(
        "presence:set",
        { roomId: "cursors:demo", state: { x, y: 0 } },
        { latestKey: "presence:cursors:demo", throttleMs: 50 },
      );

    publishAt(0.1); // leading edge, emitted immediately
    now = 10;
    publishAt(0.2);
    now = 20;
    publishAt(0.3); // only the newest frame survives the window

    const emittedStates = () =>
      socket.emitted
        .filter((entry) => entry.event === "presence:set")
        .map((entry) => (entry.args[0] as { state: { x: number } }).state.x);

    expect(emittedStates()).toEqual([0.1]);
    expect(scheduled).toHaveLength(1);

    now = 50;
    scheduled[0].callback();
    expect(emittedStates()).toEqual([0.1, 0.3]);
  });

  it("exposes transport lifecycle and connection errors", () => {
    const socket = new FakeSocket();
    const manager = new RealtimeManager({
      browserId: "browser-a",
      socketFactory: () => socket.asSocket(),
    });

    manager.setup("token-a");
    expect(manager.status).toBe("connecting");

    socket.trigger("connect_error", new Error("offline"));
    expect(manager.status).toBe("error");
    expect(manager.error?.message).toBe("offline");

    socket.connected = true;
    socket.trigger("connect");
    expect(manager.status).toBe("connected");
    expect(manager.error).toBeNull();

    socket.connected = false;
    socket.trigger("disconnect");
    expect(manager.status).toBe("reconnecting");

    socket.active = false;
    socket.trigger("disconnect", "io server disconnect");
    expect(manager.status).toBe("error");
    expect(manager.error?.message).toContain("io server disconnect");

    manager.teardown();
    expect(manager.status).toBe("idle");
    expect(manager.connected).toBe(false);
  });

  it("disposes idempotently and rejects new work", () => {
    const socket = new FakeSocket();
    const manager = new RealtimeManager({
      browserId: "browser-a",
      socketFactory: () => socket.asSocket(),
    });

    manager.setup("token-a");
    manager.dispose();
    manager.dispose();

    expect(manager.status).toBe("disposed");
    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(() => manager.setup("token-b")).toThrow("disposed");
    expect(() => manager.subscribe("event", () => undefined)).toThrow(
      "disposed",
    );
    expect(() => manager.publish("event", {})).toThrow("disposed");
    expect(() => manager.joinRoom("cursors:demo")).toThrow("disposed");
  });
});
