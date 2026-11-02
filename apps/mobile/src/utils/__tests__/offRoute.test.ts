import { describe, expect, it } from 'vitest';
import {
  distanceToPolyline,
  OFF_ROUTE_BACK_M,
  OFF_ROUTE_START_M,
  type OffRouteState,
  stepOffRoute,
} from '@/utils/offRoute';

const line: [number, number][] = [
  [0, 0],
  [0.01, 0],
];

describe('distanceToPolyline', () => {
  it('is zero on the line and measures sideways from a segment', () => {
    expect(distanceToPolyline([0.005, 0], line)).toBeCloseTo(0, 0);
    const d = distanceToPolyline([0.005, 0.0009], line);
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(105);
  });

  it('measures to the nearest end past the line', () => {
    const d = distanceToPolyline([0.011, 0], line);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(115);
  });

  it('is infinite for a line with no points and handles one point', () => {
    expect(distanceToPolyline([0, 0], [])).toBe(Number.POSITIVE_INFINITY);
    expect(distanceToPolyline([0, 0.0009], [[0, 0]])).toBeGreaterThan(95);
  });
});

describe('stepOffRoute', () => {
  const start: OffRouteState = { off: false };

  it('stays on until the athlete passes the start distance', () => {
    expect(stepOffRoute(start, OFF_ROUTE_START_M - 1)).toEqual({ off: false });
    expect(stepOffRoute(start, OFF_ROUTE_START_M + 1)).toEqual({ off: true });
  });

  it('does not flicker back inside the hysteresis band', () => {
    const off: OffRouteState = { off: true };
    expect(stepOffRoute(off, OFF_ROUTE_BACK_M + 1)).toEqual({ off: true });
    expect(stepOffRoute(off, OFF_ROUTE_BACK_M - 1)).toEqual({ off: false });
  });

  it('comes back sooner than it leaves', () => {
    expect(OFF_ROUTE_BACK_M).toBeLessThan(OFF_ROUTE_START_M);
  });
});
