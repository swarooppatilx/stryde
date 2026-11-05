import { describe, expect, it } from 'vitest';
import { inDistanceBand, routeLength } from '@/utils/distanceFilter';

describe('inDistanceBand', () => {
  it('lets everything through for any distance', () => {
    expect(inDistanceBand('any', 0)).toBe(true);
    expect(inDistanceBand('any', 80_000)).toBe(true);
  });

  it('splits at 5 km and 15 km, each boundary belonging to the longer band', () => {
    expect(inDistanceBand('short', 4999)).toBe(true);
    expect(inDistanceBand('short', 5000)).toBe(false);
    expect(inDistanceBand('medium', 5000)).toBe(true);
    expect(inDistanceBand('medium', 14_999)).toBe(true);
    expect(inDistanceBand('medium', 15_000)).toBe(false);
    expect(inDistanceBand('long', 15_000)).toBe(true);
  });
});

describe('routeLength', () => {
  it('adds up the legs between points, in metres', () => {
    // 0.01 degrees of latitude is about 1112 m.
    const length = routeLength([
      [73, 18],
      [73, 18.01],
      [73, 18.02],
    ]);

    expect(length).toBeGreaterThan(2200);
    expect(length).toBeLessThan(2250);
  });

  it('is zero for fewer than two points', () => {
    expect(routeLength([])).toBe(0);
    expect(routeLength([[73, 18]])).toBe(0);
  });
});
