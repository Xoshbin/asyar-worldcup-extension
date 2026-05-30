import { describe, it, expect } from 'vitest';
import { isFresh, RateLimiter, type CacheEnvelope } from './cache';

describe('isFresh', () => {
  const env: CacheEnvelope<number> = { data: 1, savedAt: 1000 };
  it('fresh when within ttl', () => {
    expect(isFresh(env, 5000, /*now*/ 3000)).toBe(true);   // age 2000 < ttl 5000
  });
  it('stale when past ttl', () => {
    expect(isFresh(env, 5000, /*now*/ 7000)).toBe(false);  // age 6000 > ttl 5000
  });
  it('null envelope is never fresh', () => {
    expect(isFresh(null, 5000, 1000)).toBe(false);
  });
});

describe('RateLimiter', () => {
  it('allows up to limit within window then blocks', () => {
    const rl = new RateLimiter(3, 60_000);
    expect(rl.tryAcquire(0)).toBe(true);
    expect(rl.tryAcquire(1)).toBe(true);
    expect(rl.tryAcquire(2)).toBe(true);
    expect(rl.tryAcquire(3)).toBe(false);   // 4th within window blocked
  });
  it('frees a slot once the window rolls past', () => {
    const rl = new RateLimiter(1, 60_000);
    expect(rl.tryAcquire(0)).toBe(true);
    expect(rl.tryAcquire(30_000)).toBe(false);
    expect(rl.tryAcquire(60_001)).toBe(true); // first request now outside window
  });
});
