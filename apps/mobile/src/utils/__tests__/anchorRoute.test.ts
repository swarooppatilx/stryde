import { describe, expect, it } from 'vitest';
import { anchorRoute } from '../anchorRoute';

const ROUTE = [
  { latitude: 18.5, longitude: 73.8 },
  { latitude: 18.5005, longitude: 73.8003 },
  { latitude: 18.501, longitude: 73.8 },
];

describe('anchorRoute', () => {
  it('moves the route so it starts at the anchor and keeps its shape', () => {
    const moved = anchorRoute(ROUTE, { latitude: 19.07, longitude: 72.87 });
    expect(moved[0]).toEqual({ latitude: 19.07, longitude: 72.87 });
    expect(moved[1]?.latitude).toBeCloseTo(19.0705, 6);
    expect(moved[1]?.longitude).toBeCloseTo(72.8703, 6);
    expect(moved[2]?.latitude).toBeCloseTo(19.071, 6);
    expect(moved[2]?.longitude).toBeCloseTo(72.87, 6);
  });

  it('returns the route untouched without an anchor', () => {
    expect(anchorRoute(ROUTE, null)).toBe(ROUTE);
  });

  it('copes with an empty route', () => {
    expect(anchorRoute([], { latitude: 1, longitude: 2 })).toEqual([]);
  });
});
