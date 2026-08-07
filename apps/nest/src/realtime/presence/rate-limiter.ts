// Per-socket token bucket.
//
// Cursor presence is the first high-frequency channel on this gateway. Clients
// throttle their own publishes, but the server cannot assume they will, so
// excess messages are dropped here rather than fanned out to every peer.

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export interface TokenBucketOptions {
  /** Sustained messages per second. */
  ratePerSecond: number;
  /** Maximum burst above the sustained rate. */
  burst: number;
  now?: () => number;
}

export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly ratePerSecond: number;
  private readonly burst: number;
  private readonly now: () => number;

  constructor(options: TokenBucketOptions) {
    this.ratePerSecond = options.ratePerSecond;
    this.burst = options.burst;
    this.now = options.now ?? (() => Date.now());
  }

  /** Consumes one token. Returns false when the caller should be dropped. */
  allow(key: string): boolean {
    const now = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket) {
      this.buckets.set(key, { tokens: this.burst - 1, lastRefillMs: now });
      return true;
    }

    const elapsedSeconds = Math.max(0, now - bucket.lastRefillMs) / 1000;
    bucket.tokens = Math.min(
      this.burst,
      bucket.tokens + elapsedSeconds * this.ratePerSecond,
    );
    bucket.lastRefillMs = now;

    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  release(key: string): void {
    this.buckets.delete(key);
  }
}
