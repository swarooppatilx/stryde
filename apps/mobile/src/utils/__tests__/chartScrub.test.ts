import { describe, expect, it } from 'vitest';
import { indexAtX, nearestIndex } from '@/utils/chartScrub';

const t = [0, 10, 20, 40];

describe('indexAtX', () => {
  it('picks the point nearest a touch, by time along the chart', () => {
    // 200 wide with 4 padding each side: x = 4 is the start, x = 196 the end.
    expect(indexAtX(4, 200, 4, t)).toBe(0);
    expect(indexAtX(196, 200, 4, t)).toBe(3);
    expect(indexAtX(100, 200, 4, t)).toBe(2);
  });

  it('clamps a touch outside the chart to its ends', () => {
    expect(indexAtX(-50, 200, 4, t)).toBe(0);
    expect(indexAtX(900, 200, 4, t)).toBe(3);
  });

  it('has nothing to point at without a chart or points', () => {
    expect(indexAtX(10, 0, 4, t)).toBeNull();
    expect(indexAtX(10, 200, 4, [])).toBeNull();
    expect(indexAtX(10, 200, 4, [5])).toBeNull();
  });
});

describe('nearestIndex', () => {
  it('finds the closest value, and nothing in an empty list', () => {
    expect(nearestIndex([0, 10, 20, 40], 26)).toBe(2);
    expect(nearestIndex([0, 10, 20, 40], 31)).toBe(3);
    expect(nearestIndex([], 5)).toBeNull();
  });
});
