import { POOL_ROOM_ID } from "@kingstack/shared";
import { describe, expect, it } from "vitest";
import { ViewpointBuffer } from "@/lib/pool/viewpoint-buffer";
import type { PresenceParticipant } from "@/lib/realtime/presence-room";

const ada: PresenceParticipant = { id: "ada", name: "Ada", tone: "lime" };
const maya: PresenceParticipant = { id: "maya", name: "Maya", tone: "cyan" };

function state(x: number, y: number, z: number, pointer: unknown = null) {
  return { pointer, viewpoint: { x, y, z } };
}

function upsert(participant: PresenceParticipant, value: unknown) {
  return {
    type: "presence" as const,
    roomId: POOL_ROOM_ID,
    action: "upsert" as const,
    entry: { participant, state: value },
  };
}

describe("ViewpointBuffer", () => {
  it("projects remote viewpoints and excludes the local participant", () => {
    const buffer = new ViewpointBuffer();
    buffer.setSelfParticipantId(ada.id);
    buffer.apply({
      type: "presence",
      roomId: POOL_ROOM_ID,
      action: "sync",
      entries: [
        { participant: maya, state: state(100, 900, 1_500) },
        { participant: ada, state: state(1_400, 900, -500) },
      ],
    });

    expect(buffer.count).toBe(1);
    expect(Array.from(buffer.positions.slice(0, 3))).toEqual([100, 900, 1_500]);
    expect(buffer.tones[0]).toBe(2);
  });

  it("updates a camera in place and ignores pointer-only changes", () => {
    const buffer = new ViewpointBuffer();
    buffer.apply(upsert(maya, state(100, 900, 1_500)));
    const beforePointer = buffer.version;

    buffer.apply(upsert(maya, state(100, 900, 1_500, { x: 10, y: 20 })));
    expect(buffer.version).toBe(beforePointer);

    buffer.apply(upsert(maya, state(120, 920, 1_450)));
    expect(Array.from(buffer.positions.slice(0, 3))).toEqual([120, 920, 1_450]);
    expect(buffer.version).toBe(beforePointer + 1);
  });

  it("bounds markers and promotes overflow deterministically", () => {
    const buffer = new ViewpointBuffer(1);
    buffer.apply(upsert(maya, state(200, 900, 1_500)));
    buffer.apply(upsert(ada, state(100, 900, 1_500)));
    expect(Array.from(buffer.positions.slice(0, 3))).toEqual([100, 900, 1_500]);

    buffer.apply({
      type: "presence",
      roomId: POOL_ROOM_ID,
      action: "remove",
      participantId: ada.id,
    });
    expect(Array.from(buffer.positions.slice(0, 3))).toEqual([200, 900, 1_500]);
  });
});
