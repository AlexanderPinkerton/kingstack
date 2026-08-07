import { POOL_ROOM_ID } from "@kingstack/shared";
import { describe, expect, it } from "vitest";
import { CursorBuffer } from "@/lib/pool/cursor-buffer";
import type { PresenceParticipant } from "@/lib/realtime/presence-room";

const ada: PresenceParticipant = { id: "ada", name: "Ada", tone: "lime" };
const maya: PresenceParticipant = { id: "maya", name: "Maya", tone: "cyan" };
const viewpoint = { x: 800, y: 960, z: 1_820 };

function poolState(pointer: unknown, camera = viewpoint) {
  return { pointer, viewpoint: camera };
}

function upsert(participant: PresenceParticipant, state: unknown) {
  return {
    type: "presence" as const,
    roomId: POOL_ROOM_ID,
    action: "upsert" as const,
    entry: { participant, state },
  };
}

describe("CursorBuffer", () => {
  it("projects sync, movement, null state, and removal into typed arrays", () => {
    const buffer = new CursorBuffer();
    buffer.apply({
      type: "presence",
      roomId: POOL_ROOM_ID,
      action: "sync",
      entries: [
        { participant: maya, state: poolState({ x: 20, y: 30 }) },
        { participant: ada, state: poolState({ x: 10, y: 15 }) },
      ],
    });

    expect(buffer.count).toBe(2);
    expect(Array.from(buffer.positions.slice(0, 4))).toEqual([10, 15, 20, 30]);
    expect(Array.from(buffer.tones.slice(0, 2))).toEqual([0, 2]);

    const beforeViewpoint = buffer.version;
    buffer.apply(
      upsert(ada, poolState({ x: 10, y: 15 }, { x: 900, y: 920, z: 1_700 })),
    );
    expect(buffer.version).toBe(beforeViewpoint);

    const beforeMove = buffer.version;
    buffer.apply(upsert(ada, poolState({ x: 40, y: 50 })));
    expect(Array.from(buffer.positions.slice(0, 2))).toEqual([40, 50]);
    expect(buffer.version).toBe(beforeMove + 1);

    buffer.apply(upsert(ada, poolState(null)));
    expect(buffer.count).toBe(1);
    expect(Array.from(buffer.positions.slice(0, 2))).toEqual([20, 30]);

    buffer.apply({
      type: "presence",
      roomId: POOL_ROOM_ID,
      action: "remove",
      participantId: maya.id,
    });
    expect(buffer.count).toBe(0);
  });

  it("rejects invalid points and excludes the local participant", () => {
    const buffer = new CursorBuffer();
    buffer.apply(upsert(ada, poolState({ x: -1, y: 2 })));
    expect(buffer.count).toBe(0);

    buffer.apply(upsert(ada, poolState({ x: 10, y: 20 })));
    buffer.setSelfParticipantId(ada.id);
    expect(buffer.count).toBe(0);

    buffer.setSelfParticipantId(null);
    expect(buffer.count).toBe(1);
  });

  it("bounds rendered cursors and promotes overflow deterministically", () => {
    const buffer = new CursorBuffer(2);
    const zoe: PresenceParticipant = { id: "zoe", name: "Zoe", tone: "amber" };
    buffer.apply(upsert(zoe, poolState({ x: 30, y: 30 })));
    buffer.apply(upsert(maya, poolState({ x: 20, y: 20 })));
    buffer.apply(upsert(ada, poolState({ x: 10, y: 10 })));

    expect(buffer.count).toBe(2);
    expect(Array.from(buffer.positions.slice(0, 4))).toEqual([10, 10, 20, 20]);

    buffer.apply({
      type: "presence",
      roomId: POOL_ROOM_ID,
      action: "remove",
      participantId: ada.id,
    });
    expect(Array.from(buffer.positions.slice(0, 4))).toEqual([20, 20, 30, 30]);
  });
});
