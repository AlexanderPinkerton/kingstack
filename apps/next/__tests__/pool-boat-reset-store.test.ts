import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PoolBoatResetStore } from "@/stores/userApp/poolBoatResetStore";

describe("PoolBoatResetStore", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("projects one accepted server reset into a one-second countdown", () => {
    const store = new PoolBoatResetStore();
    store.observeFrame("epoch-a", 1, 5_000, performance.now());

    expect(store.canReset).toBe(false);
    expect(store.label).toBe("Reset in 5s");
    vi.advanceTimersByTime(1_100);
    expect(store.label).toBe("Reset in 4s");
    vi.advanceTimersByTime(4_000);
    expect(store.canReset).toBe(true);
    expect(store.label).toBe("Reset boat");
    store.dispose();
  });

  it("ignores hot pose frames and clears pending on a new reset sequence", () => {
    const store = new PoolBoatResetStore();
    expect(store.beginRequest()).toBe(true);
    expect(store.beginRequest()).toBe(false);
    expect(store.label).toBe("Resetting…");

    store.observeFrame("epoch-a", 1, 5_000, performance.now());
    expect(store.pending).toBe(false);
    expect(store.label).toBe("Reset in 5s");
    store.observeFrame("epoch-a", 1, 2_000, performance.now());
    expect(store.label).toBe("Reset in 5s");
    store.dispose();
  });
});
