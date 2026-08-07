import {
  POOL_CELL_COUNT,
  POOL_GRID,
  POOL_WORLD,
  applyPoolTiles,
  decodePoolFrame,
  dequantizePoolHeight,
} from "@kingstack/shared";

export type PoolFieldApplyResult =
  | { status: "applied"; seq: number }
  | { status: "gap"; expected: number; received: number }
  | {
      status: "ignored";
      reason: "invalid" | "stale" | "missing-keyframe";
    };

/**
 * Complete browser-side copy of the quantised wave field.
 *
 * Frames are absolute, not deltas. A sequence gap is therefore observable but
 * safe to apply; the next tile update or keyframe repairs the affected cells.
 */
export class PoolField {
  readonly previous = new Int8Array(POOL_CELL_COUNT);
  readonly current = new Int8Array(POOL_CELL_COUNT);

  epoch: string | null = null;
  seq = -1;
  version = 0;
  receivedAtMs = 0;

  apply(value: unknown, nowMs = performance.now()): PoolFieldApplyResult {
    const frame = decodePoolFrame(value);
    if (!frame) return { status: "ignored", reason: "invalid" };

    if (frame.epoch !== this.epoch) {
      if (frame.action !== "keyframe") {
        return { status: "ignored", reason: "missing-keyframe" };
      }

      this.previous.fill(0);
      this.current.set(frame.data);
      this.epoch = frame.epoch;
      this.seq = frame.seq;
      this.receivedAtMs = nowMs;
      this.version += 1;
      return { status: "applied", seq: frame.seq };
    }

    if (frame.seq <= this.seq) {
      return { status: "ignored", reason: "stale" };
    }

    const expected = this.seq + 1;
    this.previous.set(this.current);
    if (frame.action === "keyframe") {
      this.current.set(frame.data);
    } else {
      applyPoolTiles(this.current, frame.mask, frame.data);
    }

    this.seq = frame.seq;
    this.receivedAtMs = nowMs;
    this.version += 1;

    return frame.seq === expected
      ? { status: "applied", seq: frame.seq }
      : { status: "gap", expected, received: frame.seq };
  }

  /** Bilinear field sample in pool-world coordinates. */
  heightAt(x: number, z: number, alpha = 1): number {
    const gridX =
      (clamp(x, 0, POOL_WORLD.width) / POOL_WORLD.width) * (POOL_GRID.cols - 1);
    const gridZ =
      (clamp(z, 0, POOL_WORLD.depth) / POOL_WORLD.depth) * (POOL_GRID.rows - 1);
    const left = Math.floor(gridX);
    const top = Math.floor(gridZ);
    const right = Math.min(left + 1, POOL_GRID.cols - 1);
    const bottom = Math.min(top + 1, POOL_GRID.rows - 1);
    const fractionX = gridX - left;
    const fractionZ = gridZ - top;
    const mix = clamp(alpha, 0, 1);

    const previous = bilinear(
      this.previous,
      left,
      right,
      top,
      bottom,
      fractionX,
      fractionZ,
    );
    const current = bilinear(
      this.current,
      left,
      right,
      top,
      bottom,
      fractionX,
      fractionZ,
    );

    return dequantizePoolHeight(previous + (current - previous) * mix);
  }

  reset(): void {
    this.previous.fill(0);
    this.current.fill(0);
    this.epoch = null;
    this.seq = -1;
    this.receivedAtMs = 0;
    this.version += 1;
  }
}

function bilinear(
  field: Int8Array,
  left: number,
  right: number,
  top: number,
  bottom: number,
  fractionX: number,
  fractionZ: number,
): number {
  const topLeft = field[top * POOL_GRID.cols + left] ?? 0;
  const topRight = field[top * POOL_GRID.cols + right] ?? 0;
  const bottomLeft = field[bottom * POOL_GRID.cols + left] ?? 0;
  const bottomRight = field[bottom * POOL_GRID.cols + right] ?? 0;
  const topValue = topLeft + (topRight - topLeft) * fractionX;
  const bottomValue = bottomLeft + (bottomRight - bottomLeft) * fractionX;
  return topValue + (bottomValue - topValue) * fractionZ;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
