import { randomUUID } from "node:crypto";
import type { AppLogger } from "@kingstack/logger";
import {
  POOL_BROADCAST_INTERVAL_MS,
  POOL_CELL_COUNT,
  POOL_GRID,
  POOL_KEYFRAME_INTERVAL_MS,
  POOL_PROTOCOL_VERSION,
  POOL_ROOM_ID,
  POOL_TILE_COUNT,
  extractPoolTiles,
  normalizePoolPoint,
  type PoolFrame,
  type PoolKeyframe,
  type PoolPoint,
  type PoolTileFrame,
} from "@kingstack/shared";
import { WaveField } from "./wave-field";

const TICK_INTERVAL_MS = 1000 / 60;
const BROADCAST_EVERY_TICKS = Math.round(
  POOL_BROADCAST_INTERVAL_MS / TICK_INTERVAL_MS,
);
const SLEEP_ENERGY_THRESHOLD = 0.01;
const MIN_POINTER_SAMPLE_MS = 8;
const MAX_POINTER_SAMPLE_MS = 250;
const MAX_POINTER_STEP = 400;
const MAX_POINTER_SPEED = 5_000;
const POINTER_STRENGTH_PER_SPEED = 0.012;
const MAX_POINTER_STRENGTH = 18;
const POINTER_RADIUS = 70;
const TAP_STRENGTH = 24;
const TAP_RADIUS = 90;
const METRIC_WINDOW_TICKS = 600;
const ESTIMATED_FRAME_ENVELOPE_BYTES = 128;

interface PointerSample {
  point: PoolPoint;
  atMs: number;
}

export interface PoolSocket {
  id: string;
  emit(event: "pool", frame: PoolKeyframe): unknown;
}

export interface GlobalPoolTransport {
  broadcastVolatile(frame: PoolFrame): void;
  broadcastReliable(frame: PoolKeyframe): void;
  unwritableSocketCount(): number;
}

export interface GlobalPoolScheduler {
  now(): number;
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface GlobalPoolOptions {
  transport: GlobalPoolTransport;
  logger: AppLogger;
  scheduler?: GlobalPoolScheduler;
  createEpoch?: () => string;
  waveField?: WaveField;
}

const DEFAULT_SCHEDULER: GlobalPoolScheduler = {
  now: () => performance.now(),
  setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
  clearInterval: (handle) =>
    clearInterval(handle as ReturnType<typeof setInterval>),
};

export class GlobalPool {
  private readonly transport: GlobalPoolTransport;
  private readonly logger: AppLogger;
  private readonly scheduler: GlobalPoolScheduler;
  private readonly field: WaveField;
  private readonly epoch: string;
  private readonly members = new Set<string>();
  private readonly pointerSamples = new Map<string, PointerSample>();
  private readonly quantised = new Int8Array(POOL_CELL_COUNT);
  private readonly liveTiles = new Uint8Array(POOL_TILE_COUNT);
  private readonly tickDurations: number[] = [];
  private tickHandle: unknown = null;
  private tickNumber = 0;
  private seq = 0;
  private lastTickAtMs = 0;
  private lastBroadcastKeyframeAtMs = 0;
  private missedFixedSteps = 0;
  private metricWindowStartedAtMs = 0;
  private metricFrames = 0;
  private metricBytesPerRecipient = 0;
  private metricEstimatedEgressBytes = 0;
  private disposed = false;

  constructor(options: GlobalPoolOptions) {
    this.transport = options.transport;
    this.logger = options.logger;
    this.scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
    this.field = options.waveField ?? new WaveField();
    this.epoch = options.createEpoch?.() ?? randomUUID();
    this.lastBroadcastKeyframeAtMs = this.scheduler.now();
    this.logger.info("realtime.pool_created", { epoch: this.epoch });
  }

  get memberCount(): number {
    return this.members.size;
  }

  get running(): boolean {
    return this.tickHandle !== null;
  }

  join(socket: PoolSocket): void {
    if (this.disposed) return;
    this.members.add(socket.id);
    this.field.quantise(this.quantised);
    socket.emit("pool", this.keyframe());
    this.logger.debug("realtime.pool_joined", {
      connectionId: socket.id,
      memberCount: this.members.size,
      seq: this.seq,
    });
  }

  leave(socketId: string): void {
    this.pointerSamples.delete(socketId);
    if (!this.members.delete(socketId)) return;

    if (this.members.size === 0) {
      this.stopTimer("empty");
      this.field.reset();
      this.quantised.fill(0);
      this.liveTiles.fill(0);
      this.tickNumber = 0;
    }

    this.logger.debug("realtime.pool_left", {
      connectionId: socketId,
      memberCount: this.members.size,
    });
  }

  clearPointer(socketId: string): void {
    this.pointerSamples.delete(socketId);
  }

  observePointer(
    socketId: string,
    value: PoolPoint | null,
    nowMs: number,
  ): void {
    if (this.disposed || !this.members.has(socketId)) return;
    if (value === null) {
      this.clearPointer(socketId);
      return;
    }

    const point = normalizePoolPoint(value);
    if (!point || !Number.isFinite(nowMs)) {
      this.clearPointer(socketId);
      return;
    }

    const previous = this.pointerSamples.get(socketId);
    this.pointerSamples.set(socketId, { point, atMs: nowMs });
    if (!previous) return;

    const elapsedMs = nowMs - previous.atMs;
    if (
      elapsedMs < MIN_POINTER_SAMPLE_MS ||
      elapsedMs > MAX_POINTER_SAMPLE_MS
    ) {
      return;
    }

    const distance = Math.hypot(
      point.x - previous.point.x,
      point.y - previous.point.y,
    );
    if (distance === 0 || distance > MAX_POINTER_STEP) return;

    const speed = Math.min(MAX_POINTER_SPEED, distance / (elapsedMs / 1000));
    const strength = Math.min(
      MAX_POINTER_STRENGTH,
      speed * POINTER_STRENGTH_PER_SPEED,
    );
    this.field.impulse(point.x, point.y, -strength, POINTER_RADIUS);
    this.startTimer("pointer");
  }

  tap(value: PoolPoint): void {
    if (this.disposed || this.members.size === 0) return;
    const point = normalizePoolPoint(value);
    if (!point) return;
    this.field.impulse(point.x, point.y, -TAP_STRENGTH, TAP_RADIUS);
    this.startTimer("tap");
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopTimer("dispose");
    this.members.clear();
    this.pointerSamples.clear();
    this.field.reset();
    this.quantised.fill(0);
    this.liveTiles.fill(0);
  }

  private startTimer(reason: "pointer" | "tap"): void {
    if (this.tickHandle !== null || this.members.size === 0 || this.disposed)
      return;
    this.lastTickAtMs = this.scheduler.now();
    this.tickHandle = this.scheduler.setInterval(
      () => this.tick(),
      TICK_INTERVAL_MS,
    );
    const maybeTimer = this.tickHandle as { unref?: () => void };
    maybeTimer.unref?.();
    this.logger.debug("realtime.pool_woke", {
      reason,
      memberCount: this.members.size,
    });
  }

  private stopTimer(reason: "empty" | "sleep" | "fault" | "dispose"): void {
    if (this.tickHandle === null) return;
    this.scheduler.clearInterval(this.tickHandle);
    this.tickHandle = null;
    this.logger.debug("realtime.pool_stopped", { reason, seq: this.seq });
  }

  private tick(): void {
    const startedAt = this.scheduler.now();
    const elapsed = startedAt - this.lastTickAtMs;
    this.lastTickAtMs = startedAt;
    if (elapsed > TICK_INTERVAL_MS * 1.5) {
      this.missedFixedSteps += Math.max(
        1,
        Math.floor(elapsed / TICK_INTERVAL_MS) - 1,
      );
    }

    try {
      this.field.step();
    } catch (error) {
      this.logger.error("realtime.pool_solver_reset", { error });
      this.field.reset();
      this.quantised.fill(0);
      this.liveTiles.fill(0);
      this.broadcastReliableKeyframe();
      this.stopTimer("fault");
      return;
    }

    this.tickNumber += 1;
    if (this.tickNumber % BROADCAST_EVERY_TICKS === 0)
      this.broadcastState(startedAt);

    const duration = this.scheduler.now() - startedAt;
    this.recordTickDuration(duration);
  }

  private broadcastState(nowMs: number): void {
    this.field.quantise(this.quantised);
    const allZero = this.quantised.every((value) => value === 0);
    if (allZero && this.field.energy() < SLEEP_ENERGY_THRESHOLD) {
      this.liveTiles.fill(0);
      this.broadcastReliableKeyframe();
      this.stopTimer("sleep");
      return;
    }

    const tiles = extractPoolTiles(this.quantised, this.liveTiles);
    const keyframeDue =
      nowMs - this.lastBroadcastKeyframeAtMs >= POOL_KEYFRAME_INTERVAL_MS;

    if (keyframeDue) {
      this.seq += 1;
      const frame = this.keyframe();
      this.transport.broadcastVolatile(frame);
      this.lastBroadcastKeyframeAtMs = nowMs;
      this.logBroadcast(frame, POOL_CELL_COUNT);
      return;
    }

    if (!tiles) return;
    this.seq += 1;
    const frame: PoolTileFrame = {
      type: "pool",
      version: POOL_PROTOCOL_VERSION,
      roomId: POOL_ROOM_ID,
      epoch: this.epoch,
      seq: this.seq,
      action: "tiles",
      mask: tiles.mask,
      data: tiles.data,
    };
    this.transport.broadcastVolatile(frame);
    this.logBroadcast(frame, tiles.data.byteLength);
  }

  private broadcastReliableKeyframe(): void {
    this.seq += 1;
    const frame = this.keyframe();
    this.transport.broadcastReliable(frame);
    this.lastBroadcastKeyframeAtMs = this.scheduler.now();
    this.logBroadcast(frame, POOL_CELL_COUNT);
  }

  private keyframe(): PoolKeyframe {
    return {
      type: "pool",
      version: POOL_PROTOCOL_VERSION,
      roomId: POOL_ROOM_ID,
      epoch: this.epoch,
      seq: this.seq,
      action: "keyframe",
      grid: POOL_GRID,
      data: this.quantised.slice(),
    };
  }

  private logBroadcast(frame: PoolFrame, dataBytes: number): void {
    const maskBytes = frame.action === "tiles" ? frame.mask.length * 2 : 0;
    const estimatedFrameBytes =
      ESTIMATED_FRAME_ENVELOPE_BYTES + maskBytes + dataBytes;
    this.metricFrames += 1;
    this.metricBytesPerRecipient += estimatedFrameBytes;
    this.metricEstimatedEgressBytes += estimatedFrameBytes * this.members.size;
    this.logger.debug("realtime.pool_broadcast", {
      action: frame.action,
      seq: frame.seq,
      dataBytes,
      estimatedFrameBytes,
      estimatedTotalEgressBytes: estimatedFrameBytes * this.members.size,
      tileCount: frame.action === "tiles" ? frame.mask.length : POOL_TILE_COUNT,
      memberCount: this.members.size,
      unwritableSockets: this.transport.unwritableSocketCount(),
    });
  }

  private recordTickDuration(durationMs: number): void {
    if (this.tickDurations.length === 0) {
      this.metricWindowStartedAtMs = this.scheduler.now();
      this.metricFrames = 0;
      this.metricBytesPerRecipient = 0;
      this.metricEstimatedEgressBytes = 0;
    }
    this.tickDurations.push(durationMs);
    if (this.tickDurations.length < METRIC_WINDOW_TICKS) return;

    const sorted = [...this.tickDurations].sort((a, b) => a - b);
    const percentile = (fraction: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
    const elapsedSeconds = Math.max(
      0.001,
      (this.scheduler.now() - this.metricWindowStartedAtMs) / 1_000,
    );
    this.logger.info("realtime.pool_tick_metrics", {
      samples: sorted.length,
      p50Ms: percentile(0.5),
      p99Ms: percentile(0.99),
      missedFixedSteps: this.missedFixedSteps,
      broadcastFrames: this.metricFrames,
      estimatedBytesPerSecondPerRecipient:
        this.metricBytesPerRecipient / elapsedSeconds,
      estimatedTotalEgressBytesPerSecond:
        this.metricEstimatedEgressBytes / elapsedSeconds,
    });
    this.tickDurations.length = 0;
    this.missedFixedSteps = 0;
  }
}
