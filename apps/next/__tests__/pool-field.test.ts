import {
  POOL_CELL_COUNT,
  POOL_GRID,
  POOL_PROTOCOL_VERSION,
  POOL_ROOM_ID,
  POOL_TILE_CELL_COUNT,
  POOL_WORLD,
  type PoolKeyframe,
  type PoolTileFrame,
} from "@kingstack/shared";
import { describe, expect, it } from "vitest";
import { PoolField } from "@/lib/pool/pool-field";

function keyframe(
  epoch: string,
  seq: number,
  data = new Int8Array(POOL_CELL_COUNT),
): PoolKeyframe {
  return {
    type: "pool",
    version: POOL_PROTOCOL_VERSION,
    roomId: POOL_ROOM_ID,
    action: "keyframe",
    epoch,
    seq,
    grid: POOL_GRID,
    data,
  };
}

function tiles(
  epoch: string,
  seq: number,
  mask: number[],
  data: Int8Array,
): PoolTileFrame {
  return {
    type: "pool",
    version: POOL_PROTOCOL_VERSION,
    roomId: POOL_ROOM_ID,
    action: "tiles",
    epoch,
    seq,
    mask,
    data,
  };
}

describe("PoolField", () => {
  it("applies keyframes and absolute tile updates", () => {
    const field = new PoolField();
    const initial = new Int8Array(POOL_CELL_COUNT);
    initial.fill(4);

    expect(field.apply(keyframe("epoch-a", 3, initial), 100)).toEqual({
      status: "applied",
      seq: 3,
    });

    const tile = new Int8Array(POOL_TILE_CELL_COUNT);
    tile.fill(20);
    expect(field.apply(tiles("epoch-a", 4, [0], tile), 200)).toEqual({
      status: "applied",
      seq: 4,
    });
    expect(field.previous[0]).toBe(4);
    expect(field.current[0]).toBe(20);
    expect(field.current[POOL_GRID.tile]).toBe(4);
    expect(field.receivedAtMs).toBe(200);
  });

  it("ignores stale frames and tiles received before an epoch keyframe", () => {
    const field = new PoolField();
    const tile = new Int8Array(POOL_TILE_CELL_COUNT);

    expect(field.apply(tiles("epoch-a", 1, [0], tile))).toEqual({
      status: "ignored",
      reason: "missing-keyframe",
    });
    field.apply(keyframe("epoch-a", 4));
    expect(field.apply(keyframe("epoch-a", 4))).toEqual({
      status: "ignored",
      reason: "stale",
    });
  });

  it("applies an absolute frame after a sequence gap", () => {
    const field = new PoolField();
    field.apply(keyframe("epoch-a", 1));
    const tile = new Int8Array(POOL_TILE_CELL_COUNT);
    tile.fill(12);

    expect(field.apply(tiles("epoch-a", 4, [0], tile))).toEqual({
      status: "gap",
      expected: 2,
      received: 4,
    });
    expect(field.current[0]).toBe(12);
  });

  it("accepts a lower sequence after a new epoch keyframe", () => {
    const field = new PoolField();
    const oldData = new Int8Array(POOL_CELL_COUNT);
    oldData.fill(25);
    field.apply(keyframe("epoch-a", 100, oldData));

    expect(field.apply(keyframe("epoch-b", 0))).toEqual({
      status: "applied",
      seq: 0,
    });
    expect(field.epoch).toBe("epoch-b");
    expect(field.current[0]).toBe(0);
    expect(field.previous[0]).toBe(0);
  });

  it("bilinearly samples and interpolates snapshots in world coordinates", () => {
    const field = new PoolField();
    const previous = new Int8Array(POOL_CELL_COUNT);
    previous.fill(0);
    field.apply(keyframe("epoch-a", 0, previous));

    const current = new Int8Array(POOL_CELL_COUNT);
    current.fill(127);
    field.apply(keyframe("epoch-a", 1, current));

    expect(
      field.heightAt(POOL_WORLD.width / 2, POOL_WORLD.depth / 2, 0.5),
    ).toBeCloseTo(40);
  });
});
