import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "../src/lib/server/fixed-window-rate-limiter";

describe("FixedWindowRateLimiter", () => {
  it("limits each identity independently and resets after the window", () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter({
      limit: 2,
      now: () => now,
      windowMs: 10_000,
    });

    expect(limiter.consume("user-a")).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.consume("user-a")).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.consume("user-a")).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 10,
    });
    expect(limiter.consume("user-b").allowed).toBe(true);

    now = 11_000;
    expect(limiter.consume("user-a")).toMatchObject({
      allowed: true,
      remaining: 1,
    });
  });
});
