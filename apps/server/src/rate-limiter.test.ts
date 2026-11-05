import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  it('rejects excess attempts and accepts after the window', () => {
    const limiter = new RateLimiter();
    expect(limiter.allow('chat:user', 2, 1_000, 1_000)).toBe(true);
    expect(limiter.allow('chat:user', 2, 1_000, 1_100)).toBe(true);
    expect(limiter.allow('chat:user', 2, 1_000, 1_200)).toBe(false);
    expect(limiter.allow('chat:user', 2, 1_000, 2_101)).toBe(true);
  });
});
