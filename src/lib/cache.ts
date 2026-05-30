export interface CacheEnvelope<T> {
  data: T;
  savedAt: number; // unix millis
}

export function isFresh<T>(env: CacheEnvelope<T> | null, ttlMs: number, now: number): boolean {
  if (!env) return false;
  return now - env.savedAt < ttlMs;
}

/** Sliding-window limiter. Call tryAcquire(now); false means "don't fetch". */
export class RateLimiter {
  private hits: number[] = [];
  constructor(private readonly limit: number, private readonly windowMs: number) {}

  tryAcquire(now: number): boolean {
    this.hits = this.hits.filter((t) => now - t < this.windowMs);
    if (this.hits.length >= this.limit) return false;
    this.hits.push(now);
    return true;
  }
}
