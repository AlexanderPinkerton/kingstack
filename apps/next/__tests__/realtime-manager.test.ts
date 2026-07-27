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
  });
});
