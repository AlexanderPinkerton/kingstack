export const POOL_ROOM_ID = "pool:global" as const;

export const POOL_WORLD = {
  width: 1600,
  depth: 1000,
} as const;

export const POOL_GRID = {
  cols: 64,
  rows: 40,
  tile: 8,
} as const;

export const POOL_HEIGHT_MAX = 80;
/** Shared gameplay/render scale so buoyancy and the visible mesh agree. */
export const POOL_PRESENTATION_HEIGHT_SCALE = 2.2;
export const POOL_PROTOCOL_VERSION = 1;
export const POOL_BROADCAST_INTERVAL_MS = 100;
export const POOL_BOAT_BROADCAST_INTERVAL_MS = 1_000 / 30;
export const POOL_BOAT_RESET_COOLDOWN_MS = 5_000;
export const POOL_KEYFRAME_INTERVAL_MS = 2_000;

export const POOL_CELL_COUNT = POOL_GRID.cols * POOL_GRID.rows;
export const POOL_TILE_CELL_COUNT = POOL_GRID.tile * POOL_GRID.tile;
export const POOL_TILE_COLS = POOL_GRID.cols / POOL_GRID.tile;
export const POOL_TILE_ROWS = POOL_GRID.rows / POOL_GRID.tile;
export const POOL_TILE_COUNT = POOL_TILE_COLS * POOL_TILE_ROWS;

export interface PoolPoint {
  x: number;
  /** Depth along the pool's Z axis. */
  y: number;
}

export interface PoolViewpoint {
  /** Zero-based pool-world X; viewpoints may stand outside the basin. */
  x: number;
  y: number;
  /** Zero-based pool-world Z; viewpoints may stand outside the basin. */
  z: number;
}

export interface PoolPresenceState {
  pointer: PoolPoint | null;
  viewpoint: PoolViewpoint;
}

export interface PoolVector3 {
  x: number;
  y: number;
  z: number;
}

export interface PoolQuaternion extends PoolVector3 {
  w: number;
}

interface PoolFrameBase {
  type: "pool";
  version: typeof POOL_PROTOCOL_VERSION;
  roomId: typeof POOL_ROOM_ID;
  epoch: string;
  seq: number;
}

export interface PoolKeyframe<TBinary = Int8Array> extends PoolFrameBase {
  action: "keyframe";
  grid: typeof POOL_GRID;
  data: TBinary;
}

export interface PoolTileFrame<TBinary = Int8Array> extends PoolFrameBase {
  action: "tiles";
  /** Strictly ascending tile indexes. */
  mask: number[];
  data: TBinary;
}

export type PoolFrame<TBinary = Int8Array> =
  PoolKeyframe<TBinary> | PoolTileFrame<TBinary>;

export interface PoolBoatFrame {
  type: "pool:boat";
  version: typeof POOL_PROTOCOL_VERSION;
  roomId: typeof POOL_ROOM_ID;
  epoch: string;
  seq: number;
  position: PoolVector3;
  rotation: PoolQuaternion;
  /** Increments only when a participant resets the boat. */
  resetSeq: number;
  /** Server-authoritative cooldown remaining when this frame was created. */
  resetCooldownMs: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function finiteInRange(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

export function normalizePoolPoint(value: unknown): PoolPoint | null {
  const record = asRecord(value);
  if (!record) return null;
  if (!finiteInRange(record.x, 0, POOL_WORLD.width)) return null;
  if (!finiteInRange(record.y, 0, POOL_WORLD.depth)) return null;
  return { x: record.x, y: record.y };
}

export function normalizePoolViewpoint(value: unknown): PoolViewpoint | null {
  const record = asRecord(value);
  if (!record) return null;
  if (!finiteInRange(record.x, -5_000, POOL_WORLD.width + 5_000)) return null;
  if (!finiteInRange(record.y, 100, 6_000)) return null;
  if (!finiteInRange(record.z, -5_000, POOL_WORLD.depth + 5_000)) return null;
  return { x: record.x, y: record.y, z: record.z };
}

export function normalizePoolPresenceState(
  value: unknown,
): PoolPresenceState | null {
  const record = asRecord(value);
  if (!record) return null;
  const pointer =
    record.pointer === null ? null : normalizePoolPoint(record.pointer);
  const viewpoint = normalizePoolViewpoint(record.viewpoint);
  if ((record.pointer !== null && !pointer) || !viewpoint) return null;
  return { pointer, viewpoint };
}

function exactBinaryView(value: unknown): Int8Array | null {
  if (value instanceof ArrayBuffer) return new Int8Array(value);
  if (!ArrayBuffer.isView(value)) return null;
  return new Int8Array(value.buffer, value.byteOffset, value.byteLength);
}

function validEpoch(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

function validSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function hasCanonicalBase(
  record: Record<string, unknown>,
): record is Record<string, unknown> & PoolFrameBase {
  return (
    record.type === "pool" &&
    record.version === POOL_PROTOCOL_VERSION &&
    record.roomId === POOL_ROOM_ID &&
    validEpoch(record.epoch) &&
    validSequence(record.seq)
  );
}

function hasCanonicalGrid(value: unknown): boolean {
  const grid = asRecord(value);
  return (
    grid?.cols === POOL_GRID.cols &&
    grid.rows === POOL_GRID.rows &&
    grid.tile === POOL_GRID.tile
  );
}

/** Validates an untrusted Socket.IO payload and preserves its exact byte view. */
export function decodePoolFrame(value: unknown): PoolFrame | null {
  const record = asRecord(value);
  if (!record || !hasCanonicalBase(record)) return null;

  const data = exactBinaryView(record.data);
  if (!data) return null;

  if (record.action === "keyframe") {
    if (!hasCanonicalGrid(record.grid) || data.byteLength !== POOL_CELL_COUNT) {
      return null;
    }
    return {
      type: "pool",
      version: POOL_PROTOCOL_VERSION,
      roomId: POOL_ROOM_ID,
      epoch: record.epoch,
      seq: record.seq,
      action: "keyframe",
      grid: POOL_GRID,
      data,
    };
  }

  if (record.action !== "tiles" || !Array.isArray(record.mask)) return null;
  if (record.mask.length === 0 || record.mask.length > POOL_TILE_COUNT) {
    return null;
  }

  const mask: number[] = [];
  let previous = -1;
  for (const value of record.mask) {
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value <= previous ||
      value >= POOL_TILE_COUNT
    ) {
      return null;
    }
    previous = value;
    mask.push(value);
  }

  if (data.byteLength !== mask.length * POOL_TILE_CELL_COUNT) return null;

  return {
    type: "pool",
    version: POOL_PROTOCOL_VERSION,
    roomId: POOL_ROOM_ID,
    epoch: record.epoch,
    seq: record.seq,
    action: "tiles",
    mask,
    data,
  };
}

function normalizeVector3(
  value: unknown,
  ranges: readonly [number, number, number, number, number, number],
): PoolVector3 | null {
  const record = asRecord(value);
  if (!record) return null;
  if (!finiteInRange(record.x, ranges[0], ranges[1])) return null;
  if (!finiteInRange(record.y, ranges[2], ranges[3])) return null;
  if (!finiteInRange(record.z, ranges[4], ranges[5])) return null;
  return { x: record.x, y: record.y, z: record.z };
}

export function decodePoolBoatFrame(value: unknown): PoolBoatFrame | null {
  const record = asRecord(value);
  if (
    !record ||
    record.type !== "pool:boat" ||
    record.version !== POOL_PROTOCOL_VERSION ||
    record.roomId !== POOL_ROOM_ID ||
    !validEpoch(record.epoch) ||
    !validSequence(record.seq) ||
    !validSequence(record.resetSeq) ||
    !finiteInRange(record.resetCooldownMs, 0, POOL_BOAT_RESET_COOLDOWN_MS)
  ) {
    return null;
  }

  const position = normalizeVector3(record.position, [
    0,
    POOL_WORLD.width,
    -POOL_HEIGHT_MAX * POOL_PRESENTATION_HEIGHT_SCALE,
    POOL_HEIGHT_MAX * POOL_PRESENTATION_HEIGHT_SCALE + 240,
    0,
    POOL_WORLD.depth,
  ]);
  const rotation = asRecord(record.rotation);
  if (!position || !rotation) return null;
  if (
    !finiteInRange(rotation.x, -1, 1) ||
    !finiteInRange(rotation.y, -1, 1) ||
    !finiteInRange(rotation.z, -1, 1) ||
    !finiteInRange(rotation.w, -1, 1)
  ) {
    return null;
  }

  const norm = Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w);
  if (norm < 0.9 || norm > 1.1) return null;
  return {
    type: "pool:boat",
    version: POOL_PROTOCOL_VERSION,
    roomId: POOL_ROOM_ID,
    epoch: record.epoch,
    seq: record.seq,
    position,
    rotation: {
      x: rotation.x / norm,
      y: rotation.y / norm,
      z: rotation.z / norm,
      w: rotation.w / norm,
    },
    resetSeq: record.resetSeq,
    resetCooldownMs: record.resetCooldownMs,
  };
}

export interface PoolTilePayload {
  mask: number[];
  data: Int8Array;
}

/**
 * Extracts live tiles and exactly one trailing zero tile after each tile dies.
 * `liveTiles` is caller-owned state and is updated in place.
 */
export function extractPoolTiles(
  field: Int8Array,
  liveTiles: Uint8Array,
): PoolTilePayload | null {
  if (field.length !== POOL_CELL_COUNT) {
    throw new RangeError(`Expected ${POOL_CELL_COUNT} pool cells`);
  }
  if (liveTiles.length !== POOL_TILE_COUNT) {
    throw new RangeError(`Expected ${POOL_TILE_COUNT} tile liveness values`);
  }

  const mask: number[] = [];
  for (let tileIndex = 0; tileIndex < POOL_TILE_COUNT; tileIndex += 1) {
    const tileRow = Math.floor(tileIndex / POOL_TILE_COLS);
    const tileCol = tileIndex % POOL_TILE_COLS;
    let isLive = false;

    for (
      let localRow = 0;
      localRow < POOL_GRID.tile && !isLive;
      localRow += 1
    ) {
      const row = tileRow * POOL_GRID.tile + localRow;
      const start = row * POOL_GRID.cols + tileCol * POOL_GRID.tile;
      for (let localCol = 0; localCol < POOL_GRID.tile; localCol += 1) {
        if (field[start + localCol] !== 0) {
          isLive = true;
          break;
        }
      }
    }

    if (isLive || liveTiles[tileIndex] === 1) mask.push(tileIndex);
    liveTiles[tileIndex] = isLive ? 1 : 0;
  }

  if (mask.length === 0) return null;

  const data = new Int8Array(mask.length * POOL_TILE_CELL_COUNT);
  let targetOffset = 0;
  for (const tileIndex of mask) {
    const tileRow = Math.floor(tileIndex / POOL_TILE_COLS);
    const tileCol = tileIndex % POOL_TILE_COLS;

    for (let localRow = 0; localRow < POOL_GRID.tile; localRow += 1) {
      const row = tileRow * POOL_GRID.tile + localRow;
      const start = row * POOL_GRID.cols + tileCol * POOL_GRID.tile;
      data.set(field.subarray(start, start + POOL_GRID.tile), targetOffset);
      targetOffset += POOL_GRID.tile;
    }
  }

  return { mask, data };
}

/** Applies an already validated tile payload to a complete quantised field. */
export function applyPoolTiles(
  field: Int8Array,
  mask: readonly number[],
  data: Int8Array,
): void {
  if (field.length !== POOL_CELL_COUNT) {
    throw new RangeError(`Expected ${POOL_CELL_COUNT} pool cells`);
  }
  if (data.length !== mask.length * POOL_TILE_CELL_COUNT) {
    throw new RangeError("Pool tile payload length does not match its mask");
  }

  let sourceOffset = 0;
  for (const tileIndex of mask) {
    if (
      !Number.isInteger(tileIndex) ||
      tileIndex < 0 ||
      tileIndex >= POOL_TILE_COUNT
    ) {
      throw new RangeError(`Invalid pool tile index: ${tileIndex}`);
    }

    const tileRow = Math.floor(tileIndex / POOL_TILE_COLS);
    const tileCol = tileIndex % POOL_TILE_COLS;
    for (let localRow = 0; localRow < POOL_GRID.tile; localRow += 1) {
      const row = tileRow * POOL_GRID.tile + localRow;
      const start = row * POOL_GRID.cols + tileCol * POOL_GRID.tile;
      field.set(
        data.subarray(sourceOffset, sourceOffset + POOL_GRID.tile),
        start,
      );
      sourceOffset += POOL_GRID.tile;
    }
  }
}

export function dequantizePoolHeight(value: number): number {
  return (value / 127) * POOL_HEIGHT_MAX;
}
