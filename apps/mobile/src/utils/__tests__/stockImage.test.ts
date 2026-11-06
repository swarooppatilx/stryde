import { describe, expect, it } from 'vitest';
import { STOCK_IMAGE_COUNT, stockImageIndex } from '@/utils/stockImage';

describe('stockImageIndex', () => {
  it('gives the same photo for the same id every time', () => {
    expect(stockImageIndex('club:7')).toBe(stockImageIndex('club:7'));
    expect(stockImageIndex(7n)).toBe(stockImageIndex(7n));
  });

  it('always lands inside the set of photos, for any id', () => {
    for (const id of ['', '0', 'club:1', 'challenge:99999999999', 12345678901234567890n, 0n, 'ü']) {
      const index = stockImageIndex(id);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(STOCK_IMAGE_COUNT);
      expect(Number.isInteger(index)).toBe(true);
    }
  });

  it('spreads neighbouring ids over the photos instead of repeating one', () => {
    const seen = new Set(Array.from({ length: 30 }, (_, i) => stockImageIndex(`club:${i}`)));
    expect(seen.size).toBe(STOCK_IMAGE_COUNT);
  });

  it('keeps a club and a challenge with the same number from always sharing a photo', () => {
    const same = Array.from(
      { length: 30 },
      (_, i) => stockImageIndex(`club:${i}`) === stockImageIndex(`challenge:${i}`)
    );
    expect(same.every(Boolean)).toBe(false);
  });
});
