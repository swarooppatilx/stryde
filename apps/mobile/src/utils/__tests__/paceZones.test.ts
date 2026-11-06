import { describe, expect, it } from 'vitest';
import type { Activity, ActivityStream } from '@/types';
import {
  PACE_ZONE_FLOORS,
  paceZoneOf,
  THRESHOLD_FROM_5K,
  thresholdSpeed,
  timeInPaceZones,
} from '@/utils/paceZones';

const DAY = 86_400_000;
const NOW = 1_000 * DAY;
const run = (
  efforts: Array<[number, number]>,
  daysAgo = 10,
  over: Partial<Activity> = {}
): Activity =>
  ({
    id: `a${Math.random()}`,
    activityType: 'run',
    distance: 12_000,
    createdAt: new Date(NOW - daysAgo * DAY),
    bestEfforts: efforts.map(([distance, movingTime]) => ({ distance, movingTime })),
    ...over,
  }) as Activity;

describe('thresholdSpeed', () => {
  it('is the speed of the fastest recent 10 km', () => {
    // 10 km in 50 min = 3.333 m/s
    const speed = thresholdSpeed(
      [run([[10_000, 3_000_000]]), run([[10_000, 3_300_000]])],
      'run',
      NOW
    );
    expect(speed).toBeCloseTo(10_000 / 3000, 5);
  });

  it('falls back to a discounted 5 km speed when there is no 10 km', () => {
    // 5 km in 25 min = 3.333 m/s
    const speed = thresholdSpeed([run([[5000, 1_500_000]])], 'run', NOW);
    expect(speed).toBeCloseTo((5000 / 1500) * THRESHOLD_FROM_5K, 5);
  });

  it('ignores other sports, hand-typed, simulated and old activities', () => {
    const acts = [
      run([[10_000, 3_000_000]], 10, { activityType: 'ride' }),
      run([[10_000, 3_000_000]], 10, { isManual: true }),
      run([[10_000, 3_000_000]], 10, { mocked: true }),
      run([[10_000, 3_000_000]], 400),
    ];
    expect(thresholdSpeed(acts, 'run', NOW)).toBeNull();
  });

  it('ignores implausibly fast efforts', () => {
    expect(thresholdSpeed([run([[10_000, 60_000]])], 'run', NOW)).toBeNull();
  });

  it('is null for a sport reported in speed', () => {
    expect(
      thresholdSpeed([run([[10_000, 3_000_000]], 10, { activityType: 'ride' })], 'ride', NOW)
    ).toBeNull();
  });
});

describe('paceZoneOf', () => {
  it('places a speed by its share of threshold speed', () => {
    expect(PACE_ZONE_FLOORS).toHaveLength(4);
    expect(paceZoneOf(2, 4)).toBe(1);
    expect(paceZoneOf(3.2, 4)).toBe(2);
    expect(paceZoneOf(3.6, 4)).toBe(3);
    expect(paceZoneOf(3.9, 4)).toBe(4);
    expect(paceZoneOf(4.5, 4)).toBe(5);
  });
});

describe('timeInPaceZones', () => {
  const stream = (speed: number[]): ActivityStream => ({
    t: speed.map((_, i) => i * 10),
    speed,
  });

  it('adds up seconds per zone and skips standing still', () => {
    const zones = timeInPaceZones(stream([2, 2, 4.5, 0.1, 4.5]), 'run', 4);
    expect(zones.map((z) => z.seconds)).toEqual([20, 0, 0, 0, 20]);
    expect(zones[0]?.share).toBeCloseTo(0.5, 5);
  });

  it('is empty without usable speeds or a threshold', () => {
    expect(timeInPaceZones(stream([0, 0, 0]), 'run', 4)).toEqual([]);
    expect(timeInPaceZones(stream([3, 3]), 'run', 0)).toEqual([]);
    expect(timeInPaceZones(stream([900, 900, 900]), 'run', 4)).toEqual([]);
  });
});
