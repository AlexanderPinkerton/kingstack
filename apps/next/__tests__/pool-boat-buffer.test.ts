import {
  POOL_BOAT_BROADCAST_INTERVAL_MS,
  POOL_PROTOCOL_VERSION,
  POOL_ROOM_ID,
  type PoolBoatFrame,
} from "@kingstack/shared";
import { describe, expect, it } from "vitest";
import { BoatBuffer } from "@/lib/pool/boat-buffer";

function frame(
  epoch: string,
  seq: number,
  x: number,
  resetSeq = 0,
  resetCooldownMs = 0,
): PoolBoatFrame {
  return {
    type: "pool:boat",
    version: POOL_PROTOCOL_VERSION,
    roomId: POOL_ROOM_ID,
    epoch,
    seq,
    position: { x, y: 8, z: 500 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    resetSeq,
    resetCooldownMs,
  };
}

describe("BoatBuffer", () => {
  it("retains adjacent poses for interpolation and rejects stale frames", () => {
    const buffer = new BoatBuffer();
    expect(buffer.apply(frame("a", 0, 800), 10)).toBe(true);
    expect(buffer.apply(frame("a", 1, 840), 20)).toBe(true);
    expect(Array.from(buffer.previousPosition)).toEqual([800, 8, 500]);
    expect(Array.from(buffer.currentPosition)).toEqual([840, 8, 500]);
    expect(buffer.receivedAtMs).toBe(20);
    expect(buffer.apply(frame("a", 1, 900), 30)).toBe(false);
  });

  it("snaps both interpolation endpoints on a new epoch", () => {
    const buffer = new BoatBuffer();
    buffer.apply(frame("a", 4, 800));
    buffer.apply(frame("b", 0, 600));

    expect(Array.from(buffer.previousPosition)).toEqual([600, 8, 500]);
    expect(Array.from(buffer.currentPosition)).toEqual([600, 8, 500]);
  });

  it("adapts its interpolation window to observed packet cadence", () => {
    const buffer = new BoatBuffer();
    const startedAt = 100;
    buffer.apply(frame("a", 0, 800), startedAt);
    buffer.apply(
      frame("a", 1, 810),
      startedAt + POOL_BOAT_BROADCAST_INTERVAL_MS,
    );
    expect(buffer.interpolationIntervalMs).toBeCloseTo(
      POOL_BOAT_BROADCAST_INTERVAL_MS,
    );

    buffer.apply(
      frame("a", 2, 820),
      startedAt + POOL_BOAT_BROADCAST_INTERVAL_MS + 50,
    );
    expect(buffer.interpolationIntervalMs).toBeCloseTo(37.5);
  });

  it("retains the authoritative global reset cooldown", () => {
    const buffer = new BoatBuffer();
    buffer.apply(frame("a", 0, 800, 3, 4_250));
    expect(buffer.resetSeq).toBe(3);
    expect(buffer.resetCooldownMs).toBe(4_250);
  });

  it("rejects malformed poses", () => {
    const buffer = new BoatBuffer();
    expect(
      buffer.apply({
        ...frame("a", 0, 800),
        rotation: { x: 0, y: 0, z: 0, w: 0 },
      }),
    ).toBe(false);
  });
});
