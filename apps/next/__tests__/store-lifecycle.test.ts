import { describe, expect, it, vi } from "vitest";
import { StoreDemand } from "../src/lib/store-lifecycle";

describe("StoreDemand", () => {
  it("notifies only on the first acquire and final release", () => {
    const onDemandChange = vi.fn();
    const demand = new StoreDemand(onDemandChange);

    const releaseFirst = demand.activate();
    const releaseSecond = demand.activate();

    expect(demand.isActive).toBe(true);
    expect(onDemandChange).toHaveBeenCalledTimes(1);

    releaseFirst();
    expect(demand.isActive).toBe(true);
    expect(onDemandChange).toHaveBeenCalledTimes(1);

    releaseSecond();
    releaseSecond();
    expect(demand.isActive).toBe(false);
    expect(onDemandChange).toHaveBeenCalledTimes(2);
  });

  it("cannot be activated after disposal", () => {
    const demand = new StoreDemand(() => undefined);
    demand.dispose();

    expect(() => demand.activate()).toThrow("disposed");
  });
});
