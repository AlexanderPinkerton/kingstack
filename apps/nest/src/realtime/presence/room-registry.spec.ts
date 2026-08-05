import { describe, expect, it } from "vitest";
import { RoomRegistry } from "./room-registry";
import type { PresenceEntry } from "./presence-protocol";

function entry(id: string, state: unknown = null): PresenceEntry {
  return {
    participant: { id, name: id, tone: "lime" },
    state,
  };
}

describe("RoomRegistry membership", () => {
  it("reports first join and treats repeat joins as idempotent", () => {
    const registry = new RoomRegistry();

    expect(registry.join("socket-a", "cursors:demo")).toBe(true);
    expect(registry.join("socket-a", "cursors:demo")).toBe(false);
    expect(registry.memberCount("cursors:demo")).toBe(1);
  });

  it("refuses presence from a socket that never joined", () => {
    const registry = new RoomRegistry();

    expect(registry.setPresence("socket-a", "cursors:demo", entry("a"))).toBeNull();
  });
});

describe("RoomRegistry presence", () => {
  it("excludes the requesting socket from its own roster snapshot", () => {
    const registry = new RoomRegistry();
    registry.join("socket-a", "cursors:demo");
    registry.join("socket-b", "cursors:demo");
    registry.setPresence("socket-a", "cursors:demo", entry("a", { x: 0, y: 0 }));
    registry.setPresence("socket-b", "cursors:demo", entry("b", { x: 1, y: 1 }));

    expect(registry.snapshot("cursors:demo", "socket-a")).toEqual([
      entry("b", { x: 1, y: 1 }),
    ]);
  });

  it("omits joined-but-idle sockets from the snapshot", () => {
    const registry = new RoomRegistry();
    registry.join("socket-a", "cursors:demo");
    registry.join("socket-b", "cursors:demo");
    registry.setPresence("socket-a", "cursors:demo", entry("a"));

    expect(registry.snapshot("cursors:demo", "socket-b")).toEqual([entry("a")]);
  });

  it("reports the superseded participant when a socket swaps identity", () => {
    const registry = new RoomRegistry();
    registry.join("socket-a", "cursors:demo");

    expect(
      registry.setPresence("socket-a", "cursors:demo", entry("first")),
    ).toEqual({ supersededParticipantId: null });
    expect(
      registry.setPresence("socket-a", "cursors:demo", entry("second")),
    ).toEqual({ supersededParticipantId: "first" });
    expect(
      registry.setPresence("socket-a", "cursors:demo", entry("second")),
    ).toEqual({ supersededParticipantId: null });
  });

  it("clears presence once and keeps the socket in the room", () => {
    const registry = new RoomRegistry();
    registry.join("socket-a", "cursors:demo");
    registry.setPresence("socket-a", "cursors:demo", entry("a"));

    expect(registry.clearPresence("socket-a", "cursors:demo")).toBe("a");
    expect(registry.clearPresence("socket-a", "cursors:demo")).toBeNull();
    expect(registry.memberCount("cursors:demo")).toBe(1);
  });
});

describe("RoomRegistry teardown", () => {
  it("retracts presence from every room a disconnected socket occupied", () => {
    const registry = new RoomRegistry();
    registry.join("socket-a", "cursors:demo");
    registry.join("socket-a", "checkboxes:global");
    registry.join("socket-b", "cursors:demo");
    registry.setPresence("socket-a", "cursors:demo", entry("a"));
    registry.setPresence("socket-a", "checkboxes:global", entry("a"));

    expect(registry.leaveAll("socket-a")).toEqual(
      expect.arrayContaining([
        { roomId: "cursors:demo", participantId: "a" },
        { roomId: "checkboxes:global", participantId: "a" },
      ]),
    );
    expect(registry.roomsFor("socket-a")).toEqual([]);
    expect(registry.memberCount("cursors:demo")).toBe(1);
    expect(registry.memberCount("checkboxes:global")).toBe(0);
  });

  it("owes no retraction for a socket that joined but never published", () => {
    const registry = new RoomRegistry();
    registry.join("socket-a", "cursors:demo");

    expect(registry.leaveAll("socket-a")).toEqual([]);
  });

  it("drops the room once its last member leaves", () => {
    const registry = new RoomRegistry();
    registry.join("socket-a", "cursors:demo");
    registry.setPresence("socket-a", "cursors:demo", entry("a"));

    expect(registry.leave("socket-a", "cursors:demo")).toEqual({
      roomId: "cursors:demo",
      participantId: "a",
    });
    expect(registry.memberCount("cursors:demo")).toBe(0);
    expect(registry.snapshot("cursors:demo")).toEqual([]);
  });
});
