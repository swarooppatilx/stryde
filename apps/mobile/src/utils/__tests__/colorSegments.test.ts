import { describe, expect, it } from 'vitest';
import { colorSegments, pointAlongRoute } from '@/utils/colorSegments';

// A straight line east along the equator: 0.001 degrees is about 111 m, so lengths are easy to reason about.
const line: [number, number][] = [
  [0, 0],
  [0.001, 0],
  [0.002, 0],
  [0.003, 0],
  [0.004, 0],
];

describe('colorSegments', () => {
  it('cuts the line where the stops change and gives each piece its stop colour', () => {
    const segments = colorSegments(line, [
      { progress: 0, color: '#aa0000' },
      { progress: 0.5, color: '#00bb00' },
      { progress: 1, color: '#0000cc' },
    ]);

    expect(segments.map((s) => s.color)).toEqual(['#aa0000', '#00bb00']);
    expect(segments[0]?.coordinates[0]).toEqual([0, 0]);
    expect(segments[0]?.coordinates.at(-1)?.[0]).toBeCloseTo(0.002, 6);
    expect(segments[1]?.coordinates[0]?.[0]).toBeCloseTo(0.002, 6);
    expect(segments[1]?.coordinates.at(-1)?.[0]).toBeCloseTo(0.004, 6);
  });

  it('starts a cut part-way along a leg at the right point', () => {
    const segments = colorSegments(line, [
      { progress: 0, color: '#111111' },
      { progress: 0.375, color: '#222222' },
      { progress: 1, color: '#333333' },
    ]);

    expect(segments[0]?.coordinates.at(-1)?.[0]).toBeCloseTo(0.0015, 6);
    expect(segments[1]?.coordinates[0]?.[0]).toBeCloseTo(0.0015, 6);
  });

  it('keeps every piece joined to the next, so the line has no gaps', () => {
    const segments = colorSegments(line, [
      { progress: 0, color: '#1' },
      { progress: 0.3, color: '#2' },
      { progress: 0.7, color: '#3' },
      { progress: 1, color: '#4' },
    ]);

    for (let i = 1; i < segments.length; i++) {
      expect(segments[i]?.coordinates[0]).toEqual(segments[i - 1]?.coordinates.at(-1));
    }
  });

  it('has nothing to cut for a line with no length or fewer than two stops', () => {
    expect(
      colorSegments(
        [[0, 0]],
        [
          { progress: 0, color: '#1' },
          { progress: 1, color: '#2' },
        ]
      )
    ).toEqual([]);
    expect(colorSegments(line, [{ progress: 0, color: '#1' }])).toEqual([]);
    expect(
      colorSegments(
        [
          [1, 1],
          [1, 1],
        ],
        [
          { progress: 0, color: '#1' },
          { progress: 1, color: '#2' },
        ]
      )
    ).toEqual([]);
  });
});

describe('pointAlongRoute', () => {
  it('finds the exact vertex when the distance lands on one', () => {
    const at = pointAlongRoute(line, 222) as [number, number]; // 0.001 deg ≈ 111 m
    expect(at[0]).toBeCloseTo(0.002, 3);
    expect(at[1]).toBe(0);
  });

  it('mixes the two ends of a leg part-way along it', () => {
    // 288 m lands inside the leg between the 0.002 and 0.003 vertices (0.001 deg ≈ 111 m).
    expect(pointAlongRoute(line, 288)).not.toBeNull();
    const at = pointAlongRoute(line, 288) as [number, number];
    expect(at[0]).toBeGreaterThan(0.0025);
    expect(at[0]).toBeLessThan(0.003);
    expect(at[1]).toBe(0);
  });

  it('clamps past the end to the last point, and refuses a line that is not one', () => {
    expect(pointAlongRoute(line, 5_000)).toEqual([0.004, 0]);
    expect(pointAlongRoute(line, -5)).toEqual([0, 0]);
    expect(pointAlongRoute([[0, 0]], 10)).toBeNull();
  });
});
