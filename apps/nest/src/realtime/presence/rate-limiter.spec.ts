import { describe, expect, it } from "vitest";
import { TokenBucketLimiter } from "./rate-limiter";

describe("TokenBucketLimiter", () => {
  it("allows a burst and then drops until tokens refill", () => {
    let now = 0;
    const limiter = new TokenBucketLimiter({
      ratePerSecond: 10,
      burst: 3,
      now: () => now,
    });

    expect(limiter.allow("socket-a")).toBe(true);
    expect(limiter.allow("socket-a")).toBe(true);
    expect(limiter.allow("socket-a")).toBe(true);
    expect(limiter.allow("socket-a")).toBe(false);

    now += 100; // one token at 10/s
    expect(limiter.allow("socket-a")).toBe(true);
    expect(limiter.allow("socket-a")).toBe(false);
  });

  it("meters each socket independently", () => {
    const now = 0;
    const limiter = new TokenBucketLimiter({
      ratePerSecond: 1,
      burst: 1,
      now: () => now,
    });

    expect(limiter.allow("socket-a")).toBe(true);
    expect(limiter.allow("socket-a")).toBe(false);
    expect(limiter.allow("socket-b")).toBe(true);
  });

  it("never accumulates more than the burst allowance", () => {
    let now = 0;
    const limiter = new TokenBucketLimiter({
      ratePerSecond: 10,
      burst: 2,
      now: () => now,
    });

    expect(limiter.allow("socket-a")).toBe(true);
    now += 60_000;
    expect(limiter.allow("socket-a")).toBe(true);
    expect(limiter.allow("socket-a")).toBe(true);
    expect(limiter.allow("socket-a")).toBe(false);
  });

  it("forgets a released socket", () => {
    const now = 0;
    const limiter = new TokenBucketLimiter({
      ratePerSecond: 1,
      burst: 1,
      now: () => now,
    });

    expect(limiter.allow("socket-a")).toBe(true);
    expect(limiter.allow("socket-a")).toBe(false);
    limiter.release("socket-a");
    expect(limiter.allow("socket-a")).toBe(true);
  });
});
