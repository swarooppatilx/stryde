import { describe, expect, it } from 'vitest';
import type { Location } from '@/types';
import { computeBestEfforts } from '@/utils/bestEfforts';

const METERS_PER_DEGREE = 111_195;
const point = (meters: number, seconds: number): Location => ({
  latitude: meters / METERS_PER_DEGREE,
  longitude: 0,
  timestamp: seconds * 1000,
  accuracy: 5,
});

/** Runs a list of (meters, speed m/s) legs, one fix every 5 s. */
function legs(...plan: Array<[meters: number, speed: number]>): Location[] {
  const points = [point(0, 0)];
  let meters = 0;
  let seconds = 0;
  for (const [length, speed] of plan) {
    const end = meters + length;
    while (meters < end - 1e-6) {
      const step = Math.min(speed * 5, end - meters);
      meters += step;
      seconds += step / speed;
      points.push(point(meters, seconds));
    }
  }
  return points;
}

const byDistance = (efforts: ReturnType<typeof computeBestEfforts>, distance: number) =>
  efforts.find((e) => e.distance === distance);

describe('computeBestEfforts', () => {
  it('times the fastest stretch of each distance the run reached', () => {
    // A steady 4 m/s (4:10/km) for 6 km: 1 km = 250 s, 5 km = 1250 s, no 10 km.
    const efforts = computeBestEfforts(legs([6_000, 4]), 6000, 'run');

    expect(byDistance(efforts, 1000)?.movingTime).toBeCloseTo(250_000, -3);
    expect(byDistance(efforts, 5000)?.movingTime).toBeCloseTo(1_250_000, -3);
    expect(byDistance(efforts, 10_000)).toBeUndefined();
  });

  it('finds a fast kilometre that does not line up with a kilometre marker', () => {
    // 500 m easy, 1 km at 5 m/s (200 s), then 500 m easy: the fast km sits across the 1 km mark.
    const efforts = computeBestEfforts(legs([500, 3], [1000, 5], [500, 3]), 2000, 'run');

    expect(byDistance(efforts, 1000)?.movingTime).toBeCloseTo(200_000, -3);
  });

  it('leaves a long stop out of the time', () => {
    // 1 km, a 5-minute stand-still, then 1 km more at the same speed.
    const run = legs([1000, 4]);
    const lastTime = (run.at(-1) as Location).timestamp;
    const resumed = legs([1000, 4]).map((p, i) => ({
      ...p,
      latitude: p.latitude + 1000 / METERS_PER_DEGREE,
      timestamp: lastTime + 300_000 + p.timestamp - (i === 0 ? 0 : 0),
    }));

    const efforts = computeBestEfforts([...run, ...resumed], 2000, 'run');

    // 2 km total moving time is 500 s, not 800 s.
    expect(byDistance(efforts, 1000)?.movingTime).toBeCloseTo(250_000, -3);
  });

  it('has nothing to report for a run under the shortest distance', () => {
    expect(computeBestEfforts(legs([300, 4]), 300, 'run')).toEqual([]);
    expect(computeBestEfforts([], 0, 'run')).toEqual([]);
  });

  it('does not report an effort longer than the activity distance', () => {
    expect(computeBestEfforts(legs([1000, 4]), 425, 'walk')).toEqual([]);
  });

  it('rejects an effort faster than the sport limit', () => {
    expect(computeBestEfforts(legs([1000, 5]), 1000, 'walk')).toEqual([]);
  });

  it('leaves out efforts with too few GPS fixes to time reliably', () => {
    const sparse = [point(0, 0), point(500, 100_000), point(1000, 200_000)];
    expect(computeBestEfforts(sparse, 1000, 'run')).toEqual([]);
  });

  it('times the short and long standard distances too', () => {
    const efforts = computeBestEfforts(legs([22_000, 4]), 22_000, 'run');
    expect(efforts.map((e) => e.distance)).toEqual([400, 1000, 1609, 5000, 10_000, 21_097]);
    expect(byDistance(efforts, 1609)?.movingTime).toBeCloseTo((1609 / 4) * 1000, -3);
  });

  it('adds the marathon only for a run that went that far', () => {
    expect(computeBestEfforts(legs([42_300, 3.5]), 42_300, 'run').at(-1)?.distance).toBe(42_195);
  });
});
