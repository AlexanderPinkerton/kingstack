import { describe, expect, it } from "vitest";
import {
  POOL_CELL_COUNT,
  POOL_GRID,
  POOL_PROTOCOL_VERSION,
  POOL_ROOM_ID,
  POOL_TILE_COUNT,
  applyPoolTiles,
  decodePoolBoatFrame,
  decodePoolFrame,
  extractPoolTiles,
  normalizePoolPoint,
  normalizePoolPresenceState,
} from "@kingstack/shared";

describe("pool protocol validation", () => {
  it("accepts exact pool points and rejects points outside the world", () => {
    expect(normalizePoolPoint({ x: 1600, y: 1000 })).toEqual({
      x: 1600,
      y: 1000,
    });
    expect(normalizePoolPoint({ x: -1, y: 500 })).toBeNull();
    expect(normalizePoolPoint({ x: 500, y: 1001 })).toBeNull();
    expect(normalizePoolPoint({ x: Number.NaN, y: 500 })).toBeNull();
  });

  it("validates combined pointer and viewpoint presence", () => {
    const state = {
      pointer: { x: 400, y: 500 },
      viewpoint: { x: -300, y: 900, z: 1_500 },
    };
    expect(normalizePoolPresenceState(state)).toEqual(state);
    expect(normalizePoolPresenceState({ ...state, pointer: null })).toEqual({
      ...state,
      pointer: null,
    });
    expect(
      normalizePoolPresenceState({
        ...state,
        viewpoint: { ...state.viewpoint, y: 99 },
      }),
    ).toBeNull();
  });

  it("validates and normalizes authoritative boat poses", () => {
    const decoded = decodePoolBoatFrame({
      type: "pool:boat",
      version: POOL_PROTOCOL_VERSION,
      roomId: POOL_ROOM_ID,
      epoch: "epoch-a",
      seq: 3,
      position: { x: 800, y: 8, z: 500 },
      rotation: { x: 0, y: 0, z: 0, w: 0.95 },
      resetSeq: 1,
      resetCooldownMs: 4_000,
    });
    expect(decoded?.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(decoded?.resetCooldownMs).toBe(4_000);
    expect(
      decodePoolBoatFrame({
        ...decoded,
        rotation: { x: 0, y: 0, z: 0, w: 0 },
      }),
    ).toBeNull();
    expect(
      decodePoolBoatFrame({
        ...decoded,
        resetCooldownMs: 5_001,
      }),
    ).toBeNull();
  });

  it("preserves the exact byte range of a keyframe view", () => {
    const allocation = new Int8Array(POOL_CELL_COUNT + 2);
    allocation[1] = -37;
    const view = allocation.subarray(1, allocation.length - 1);

    const decoded = decodePoolFrame({
      type: "pool",
      version: POOL_PROTOCOL_VERSION,
      roomId: POOL_ROOM_ID,
      epoch: "epoch-a",
      seq: 4,
      action: "keyframe",
      grid: POOL_GRID,
      data: view,
    });

    expect(decoded?.action).toBe("keyframe");
    expect(decoded?.data).toHaveLength(POOL_CELL_COUNT);
    expect(decoded?.data[0]).toBe(-37);
  });

  it("rejects malformed versions, masks, ordering, and byte lengths", () => {
    const base = {
      type: "pool",
      version: POOL_PROTOCOL_VERSION,
      roomId: POOL_ROOM_ID,
      epoch: "epoch-a",
      seq: 4,
    } as const;

    expect(
      decodePoolFrame({
        ...base,
        version: 2,
        action: "keyframe",
        grid: POOL_GRID,
        data: new Int8Array(POOL_CELL_COUNT),
      }),
    ).toBeNull();
    expect(
      decodePoolFrame({
        ...base,
        action: "tiles",
        mask: [2, 2],
        data: new Int8Array(128),
      }),
    ).toBeNull();
    expect(
      decodePoolFrame({
        ...base,
        action: "tiles",
        mask: [POOL_TILE_COUNT],
        data: new Int8Array(64),
      }),
    ).toBeNull();
    expect(
      decodePoolFrame({
        ...base,
        action: "tiles",
        mask: [0],
        data: new Int8Array(63),
      }),
    ).toBeNull();
  });
});

describe("pool tile codec", () => {
  it("roundtrips live tiles and sends exactly one trailing zero frame", () => {
    const source = new Int8Array(POOL_CELL_COUNT);
    const reconstructed = new Int8Array(POOL_CELL_COUNT);
    const liveTiles = new Uint8Array(POOL_TILE_COUNT);
    source[0] = 12;
    source[POOL_GRID.cols * 17 + 23] = -8;

    const live = extractPoolTiles(source, liveTiles);
    expect(live).not.toBeNull();
    applyPoolTiles(reconstructed, live!.mask, live!.data);
    expect(reconstructed).toEqual(source);

    source.fill(0);
    const trailingZero = extractPoolTiles(source, liveTiles);
    expect(trailingZero?.mask).toEqual(live?.mask);
    applyPoolTiles(reconstructed, trailingZero!.mask, trailingZero!.data);
    expect(reconstructed).toEqual(source);

    expect(extractPoolTiles(source, liveTiles)).toBeNull();
  });
});
