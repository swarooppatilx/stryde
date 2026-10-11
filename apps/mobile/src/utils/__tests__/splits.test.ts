import { describe, expect, it } from 'vitest';
import type { Location } from '@/types';
import { computeSplits } from '@/utils/splits';

// ~111.2 m per 0.001 degree of latitude.
const METERS_PER_DEGREE = 111_195;
const point = (meters: number, seconds: number): Location => ({
  latitude: meters / METERS_PER_DEGREE,
  longitude: 0,
  timestamp: seconds * 1000,
  accuracy: 5,
});

/** A steady runner: one fix every 10 s at the given speed. */
function steady(speedMs: number, totalMeters: number, startSeconds = 0): Location[] {
  const points: Location[] = [];
  for (let t = 0; t * speedMs <= totalMeters; t += 10) {
    points.push(point(t * speedMs, startSeconds + t));
  }
  return points;
}

describe('computeSplits', () => {
  it('gives one split per full kilometre with its time', () => {
    const splits = computeSplits(steady(4, 2_000), 1000);

    expect(splits.map((s) => s.index)).toEqual([1, 2]);
    for (const split of splits) {
      expect(split.distance).toBeCloseTo(1000, 0);
      expect(split.movingTime).toBeGreaterThan(245_000);
      expect(split.movingTime).toBeLessThan(255_000);
    }
  });

  it('reports a trailing partial split with its own distance', () => {
    const splits = computeSplits(steady(4, 1_500), 1000);

    expect(splits).toHaveLength(2);
    expect(splits[1]?.distance).toBeGreaterThan(400);
    expect(splits[1]?.distance).toBeLessThan(600);
  });

  it('does not count a long stop as running time', () => {
    const run = steady(4, 1_000);
    const lastRun = run[run.length - 1] as Location;
    const afterPause = point(1_000, lastRun.timestamp / 1000 + 600);
    const splits = computeSplits(
      [...run, afterPause, point(1_040, lastRun.timestamp / 1000 + 610)],
      1000
    );

    expect(splits[0]?.movingTime).toBeLessThan(260_000);
  });

  it('returns nothing for fewer than two fixes', () => {
    expect(computeSplits([], 1000)).toEqual([]);
    expect(computeSplits([point(0, 0)], 1000)).toEqual([]);
  });

  describe('elevation', () => {
    /** Climbs 0.05 m per metre travelled (a 5% grade) over `totalMeters`. */
    const climbing = (totalMeters: number, grade: number): Location[] =>
      steady(4, totalMeters).map((p, n) => ({ ...p, altitude: 100 + n * 40 * grade }));

    it('gives each split its net climb', () => {
      const splits = computeSplits(climbing(3_000, 0.05), 1000);
      for (const split of splits) expect(split.elevation).toBeGreaterThanOrEqual(45);
      for (const split of splits) expect(split.elevation).toBeLessThanOrEqual(55);
    });

    it('is negative on a descent', () => {
      const splits = computeSplits(climbing(2_000, -0.05), 1000);
      expect(splits[0]?.elevation).toBeLessThan(-40);
    });

    it('is left out when the recording has no altitude', () => {
      const splits = computeSplits(steady(4, 2_000), 1000);
      expect(splits[0]?.elevation).toBeUndefined();
    });
  });
});
