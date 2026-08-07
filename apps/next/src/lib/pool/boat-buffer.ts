import {
  POOL_BOAT_BROADCAST_INTERVAL_MS,
  decodePoolBoatFrame,
} from "@kingstack/shared";

const MIN_INTERPOLATION_INTERVAL_MS = 16;
const MAX_INTERPOLATION_INTERVAL_MS = 150;
const INTERVAL_SMOOTHING = 0.25;

export class BoatBuffer {
  readonly previousPosition = new Float32Array(3);
  readonly currentPosition = new Float32Array(3);
  readonly previousRotation = new Float32Array([0, 0, 0, 1]);
  readonly currentRotation = new Float32Array([0, 0, 0, 1]);
  epoch: string | null = null;
  seq = -1;
  version = 0;
  receivedAtMs = 0;
  interpolationIntervalMs = POOL_BOAT_BROADCAST_INTERVAL_MS;
  resetSeq = 0;
  resetCooldownMs = 0;

  apply(value: unknown, nowMs = performance.now()): boolean {
    const frame = decodePoolBoatFrame(value);
    if (!frame) return false;
    if (frame.epoch === this.epoch && frame.seq <= this.seq) return false;

    const isNewEpoch = frame.epoch !== this.epoch;
    if (!isNewEpoch) {
      this.previousPosition.set(this.currentPosition);
      this.previousRotation.set(this.currentRotation);
      const observedInterval = nowMs - this.receivedAtMs;
      if (Number.isFinite(observedInterval) && observedInterval > 0) {
        const boundedInterval = Math.min(
          MAX_INTERPOLATION_INTERVAL_MS,
          Math.max(MIN_INTERPOLATION_INTERVAL_MS, observedInterval),
        );
        this.interpolationIntervalMs +=
          (boundedInterval - this.interpolationIntervalMs) * INTERVAL_SMOOTHING;
      }
    }
    this.currentPosition[0] = frame.position.x;
    this.currentPosition[1] = frame.position.y;
    this.currentPosition[2] = frame.position.z;
    this.currentRotation[0] = frame.rotation.x;
    this.currentRotation[1] = frame.rotation.y;
    this.currentRotation[2] = frame.rotation.z;
    this.currentRotation[3] = frame.rotation.w;
    if (isNewEpoch) {
      this.previousPosition.set(this.currentPosition);
      this.previousRotation.set(this.currentRotation);
      this.interpolationIntervalMs = POOL_BOAT_BROADCAST_INTERVAL_MS;
    }
    this.epoch = frame.epoch;
    this.seq = frame.seq;
    this.resetSeq = frame.resetSeq;
    this.resetCooldownMs = frame.resetCooldownMs;
    this.receivedAtMs = nowMs;
    this.version += 1;
    return true;
  }

  reset(): void {
    this.previousPosition.fill(0);
    this.currentPosition.fill(0);
    this.previousRotation.fill(0);
    this.currentRotation.fill(0);
    this.previousRotation[3] = 1;
    this.currentRotation[3] = 1;
    this.epoch = null;
    this.seq = -1;
    this.receivedAtMs = 0;
    this.interpolationIntervalMs = POOL_BOAT_BROADCAST_INTERVAL_MS;
    this.resetSeq = 0;
    this.resetCooldownMs = 0;
    this.version += 1;
  }
}
