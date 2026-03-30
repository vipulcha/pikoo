import { log } from "./logger.js";

interface BucketEntry {
  tokens: number;
  lastRefill: number;
}

interface TokenBucketOpts {
  maxTokens: number;
  refillRate: number; // tokens per second
  label: string;
}

/**
 * In-memory token-bucket rate limiter.
 * Each key (IP or socket ID) gets its own bucket.
 * Stale buckets are swept every 60s to avoid memory leaks.
 */
export class TokenBucket {
  private buckets = new Map<string, BucketEntry>();
  private opts: TokenBucketOpts;
  private sweepTimer: ReturnType<typeof setInterval>;

  constructor(opts: TokenBucketOpts) {
    this.opts = opts;
    this.sweepTimer = setInterval(() => this.sweep(), 60_000);
    this.sweepTimer.unref();
  }

  consume(key: string, cost = 1): boolean {
    const now = Date.now();
    let entry = this.buckets.get(key);

    if (!entry) {
      entry = { tokens: this.opts.maxTokens, lastRefill: now };
      this.buckets.set(key, entry);
    }

    const elapsed = (now - entry.lastRefill) / 1000;
    entry.tokens = Math.min(this.opts.maxTokens, entry.tokens + elapsed * this.opts.refillRate);
    entry.lastRefill = now;

    if (entry.tokens >= cost) {
      entry.tokens -= cost;
      return true;
    }

    log.security.warn("Rate limit exceeded", { limiter: this.opts.label, key: key.slice(-12) });
    return false;
  }

  private sweep() {
    const cutoff = Date.now() - 120_000;
    for (const [key, entry] of this.buckets) {
      if (entry.lastRefill < cutoff) this.buckets.delete(key);
    }
  }

  destroy() {
    clearInterval(this.sweepTimer);
  }
}

// REST: room creation — 5 rooms per minute per IP
export const roomCreateLimiter = new TokenBucket({
  maxTokens: 5,
  refillRate: 5 / 60,
  label: "room-create",
});

// REST: general GET — 60 requests per minute per IP
export const restGetLimiter = new TokenBucket({
  maxTokens: 60,
  refillRate: 1,
  label: "rest-get",
});

// WebSocket: general events — 30 events per 10s per socket
export const socketEventLimiter = new TokenBucket({
  maxTokens: 30,
  refillRate: 3,
  label: "ws-event",
});

// WebSocket: chat messages — 10 messages per 10s per socket
export const chatMessageLimiter = new TokenBucket({
  maxTokens: 10,
  refillRate: 1,
  label: "ws-chat",
});

// WebSocket: connection — 10 connections per minute per IP
export const connectionLimiter = new TokenBucket({
  maxTokens: 10,
  refillRate: 10 / 60,
  label: "ws-connect",
});
