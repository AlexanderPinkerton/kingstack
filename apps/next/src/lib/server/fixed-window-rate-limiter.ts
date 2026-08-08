import "server-only";

export interface FixedWindowRateLimiterOptions {
  limit: number;
  now?: () => number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface WindowState {
  count: number;
  resetAt: number;
}

/**
 * A process-local safety limit for deployments with one warm Next.js process.
 * Distributed deployments should replace it with a shared store.
 */
export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, WindowState>();
  private readonly limit: number;
  private readonly now: () => number;
  private readonly windowMs: number;

  constructor(options: FixedWindowRateLimiterOptions) {
    if (!Number.isInteger(options.limit) || options.limit <= 0) {
      throw new Error("Rate limit must be a positive integer");
    }
    if (!Number.isFinite(options.windowMs) || options.windowMs <= 0) {
      throw new Error("Rate-limit window must be greater than zero");
    }

    this.limit = options.limit;
    this.now = options.now ?? Date.now;
    this.windowMs = options.windowMs;
  }

  consume(key: string): RateLimitResult {
    const now = this.now();
    this.pruneExpired(now);

    const existing = this.entries.get(key);
    const state = existing ?? { count: 0, resetAt: now + this.windowMs };

    if (state.count >= this.limit) {
      return this.result(false, state, now);
    }

    state.count += 1;
    this.entries.set(key, state);
    return this.result(true, state, now);
  }

  private pruneExpired(now: number): void {
    this.entries.forEach((entry, key) => {
      if (entry.resetAt <= now) this.entries.delete(key);
    });
  }

  private result(
    allowed: boolean,
    state: WindowState,
    now: number,
  ): RateLimitResult {
    return {
      allowed,
      limit: this.limit,
      remaining: Math.max(0, this.limit - state.count),
      resetAt: state.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - now) / 1_000)),
    };
  }
}
