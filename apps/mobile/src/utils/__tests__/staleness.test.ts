import { describe, expect, it } from 'vitest';
import { isStale } from '@/utils/staleness';

describe('isStale', () => {
  it('is stale when nothing has been loaded yet', () => {
    expect(isStale(null, 1_000, 30_000)).toBe(true);
  });

  it('is fresh within the window and stale at or after its end', () => {
    expect(isStale(1_000, 20_000, 30_000)).toBe(false);
    expect(isStale(1_000, 31_000, 30_000)).toBe(true);
    expect(isStale(1_000, 40_000, 30_000)).toBe(true);
  });

  it('treats a clock that went backwards as stale rather than fresh forever', () => {
    expect(isStale(50_000, 10_000, 30_000)).toBe(true);
  });
});
