import { describe, expect, it } from "vitest";
import { createNoopLogger } from "@kingstack/logger/testing";
import {
  POOL_CELL_COUNT,
  type PoolFrame,
  type PoolKeyframe,
} from "@kingstack/shared";
import {
  GlobalPool,
  type GlobalPoolScheduler,
  type GlobalPoolTransport,
  type PoolSocket,
} from "./global-pool";

class FakeScheduler implements GlobalPoolScheduler {
  nowMs = 0;
  callback: (() => void) | null = null;
  clearCount = 0;

  now(): number {
    return this.nowMs;
  }

  setInterval(callback: () => void): unknown {
    this.callback = callback;
    return { id: 1 };
  }

  clearInterval(): void {
    this.clearCount += 1;
    this.callback = null;
  }

  advanceTicks(count: number): void {
    for (let index = 0; index < count; index += 1) {
      this.nowMs += 1000 / 60;
      this.callback?.();
    }
  }
}

class FakeTransport implements GlobalPoolTransport {
  readonly volatile: PoolFrame[] = [];
  readonly reliable: PoolKeyframe[] = [];
  unwritable = 0;

  broadcastVolatile(frame: PoolFrame): void {
    this.volatile.push(frame);
  }

  broadcastReliable(frame: PoolKeyframe): void {
    this.reliable.push(frame);
  }

  unwritableSocketCount(): number {
    return this.unwritable;
  }
}

function socket(id: string) {
  const keyframes: PoolKeyframe[] = [];
  const value: PoolSocket = {
    id,
    emit: (_event, frame) => keyframes.push(frame),
  };
  return { value, keyframes };
}

function setup() {
  const scheduler = new FakeScheduler();
  const transport = new FakeTransport();
  const pool = new GlobalPool({
    scheduler,
    transport,
    logger: createNoopLogger(),
    createEpoch: () => "test-epoch",
  });
  return { scheduler, transport, pool };
}

describe("GlobalPool lifecycle", () => {
  it("uses idempotent membership and sends every join a keyframe", () => {
    const { pool } = setup();
    const first = socket("a");
    const second = socket("b");

    pool.join(first.value);
    pool.join(first.value);
    pool.join(second.value);

    expect(pool.memberCount).toBe(2);
    expect(first.keyframes).toHaveLength(2);
    expect(second.keyframes).toHaveLength(1);
    expect(first.keyframes[0].epoch).toBe("test-epoch");
    expect(first.keyframes[0].data).toHaveLength(POOL_CELL_COUNT);
  });

  it("stops and resets when the last socket leaves", () => {
    const { pool, scheduler } = setup();
    const first = socket("a");
    pool.join(first.value);
    pool.tap({ x: 800, y: 500 });
    expect(pool.running).toBe(true);

    pool.leave("a");
    expect(pool.running).toBe(false);
    expect(scheduler.clearCount).toBe(1);

    const next = socket("b");
    pool.join(next.value);
    expect(next.keyframes[0].data.every((value) => value === 0)).toBe(true);
  });

  it("quantises the current field for a late join between broadcasts", () => {
    const { pool, scheduler } = setup();
    pool.join(socket("a").value);
    pool.tap({ x: 800, y: 500 });
    scheduler.advanceTicks(1);

    const late = socket("b");
    pool.join(late.value);

    expect(late.keyframes[0].data.some((value) => value !== 0)).toBe(true);
  });
});

describe("GlobalPool input and broadcast", () => {
  it("establishes a pointer baseline, injects bounded motion, and emits tiles", () => {
    const { pool, scheduler, transport } = setup();
    pool.join(socket("a").value);

    pool.observePointer("a", { x: 500, y: 500 }, 0);
    expect(pool.running).toBe(false);
    pool.observePointer("a", { x: 540, y: 500 }, 33);
    expect(pool.running).toBe(true);

    scheduler.advanceTicks(6);
    expect(transport.volatile.at(-1)?.action).toBe("tiles");
  });

  it("treats null, re-entry, long gaps, and teleports as new baselines", () => {
    const { pool } = setup();
    pool.join(socket("a").value);

    pool.observePointer("a", { x: 10, y: 10 }, 0);
    pool.clearPointer("a");
    pool.observePointer("a", { x: 1500, y: 900 }, 33);
    pool.observePointer("a", { x: 0, y: 0 }, 66);
    pool.observePointer("a", { x: 20, y: 20 }, 1_000);

    expect(pool.running).toBe(false);
  });

  it("uses volatile recovery keyframes and a reliable final zero on sleep", () => {
    const { pool, scheduler, transport } = setup();
    pool.join(socket("a").value);
    pool.tap({ x: 800, y: 500 });

    scheduler.advanceTicks(120);
    expect(
      transport.volatile.some((frame) => frame.action === "keyframe"),
    ).toBe(true);

    scheduler.advanceTicks(10_000);
    expect(pool.running).toBe(false);
    expect(transport.reliable.length).toBeGreaterThan(0);
    expect(transport.reliable.at(-1)?.data.every((value) => value === 0)).toBe(
      true,
    );
  });
});
