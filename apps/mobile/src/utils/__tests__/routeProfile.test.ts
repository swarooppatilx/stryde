import { describe, expect, it } from 'vitest';
import { routeProfile } from '@/utils/routeProfile';

const line: [number, number][] = [
  [0, 0],
  [0.005, 0],
  [0.01, 0],
];

describe('routeProfile', () => {
  it('spreads elevations over the distance along the line', () => {
    const p = routeProfile(line, [10, 30, 20]);
    expect(p).not.toBeNull();
    expect(p?.values).toEqual([10, 30, 20]);
    expect(p?.times[0]).toBe(0);
    expect(p?.times[1]).toBeCloseTo((p?.times[2] ?? 0) / 2, 0);
    expect(p?.gain).toBe(20);
    expect(p?.loss).toBe(10);
  });

  it('spaces fewer elevations than points evenly over the length', () => {
    const p = routeProfile(line, [0, 100]);
    expect(p?.times).toHaveLength(2);
    expect(p?.times[1]).toBeCloseTo(p?.total ?? 0, 0);
  });

  it('is null without two elevations or a line with length', () => {
    expect(routeProfile(line, [5])).toBeNull();
    expect(routeProfile([[0, 0]], [1, 2])).toBeNull();
    expect(
      routeProfile(
        [
          [0, 0],
          [0, 0],
        ],
        [1, 2]
      )
    ).toBeNull();
  });
});
