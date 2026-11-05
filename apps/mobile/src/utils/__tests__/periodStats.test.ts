import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import { periodStats, sportBreakdown, sportsDone } from '@/utils/periodStats';

const NOW = new Date(2026, 9, 21, 12, 0, 0); // Wed 21 Oct 2026, local time

const act = (
  iso: string,
  distance: number,
  duration = 1_800_000,
  extra: Partial<Activity> = {}
): Activity =>
  ({
    id: iso + distance,
    activityType: 'run',
    distance,
    duration,
    createdAt: new Date(iso),
    ...extra,
  }) as Activity;

describe('periodStats', () => {
  const activities = [
    act('2026-10-20T07:00:00', 5000, 1_500_000, { elevationGain: 40 }), // yesterday
    act('2026-10-20T18:00:00', 3000), // same day: one active day, two activities
    act('2026-10-01T07:00:00', 10_000, 3_600_000, { elevationGain: 120 }), // 20 days ago
    act('2026-08-15T07:00:00', 8000), // this year, not last 4 weeks
    act('2025-06-01T07:00:00', 20_000, 7_200_000, { elevationGain: 300 }), // last year
  ];

  it('totals the last four weeks, this calendar year and everything', () => {
    const stats = periodStats(activities, NOW);

    expect(stats.recent).toMatchObject({ count: 3, distance: 18_000, elevation: 160 });
    expect(stats.thisYear).toMatchObject({ count: 4, distance: 26_000 });
    expect(stats.allTime).toMatchObject({ count: 5, distance: 46_000, elevation: 460 });
  });

  it('totals this calendar month', () => {
    const { thisMonth } = periodStats(activities, NOW);

    expect(thisMonth).toMatchObject({ count: 3, distance: 18_000 });
    expect(periodStats(activities, new Date(2026, 7, 31, 12)).thisMonth).toMatchObject({
      count: 1,
      distance: 8000,
    });
  });

  it('adds up time and counts each day with an activity once', () => {
    const { recent } = periodStats(activities, NOW);

    expect(recent.duration).toBe(1_500_000 + 1_800_000 + 3_600_000);
    expect(recent.activeDays).toBe(2);
  });

  it('averages distance per week over the period', () => {
    const { recent, allTime } = periodStats(activities, NOW);

    expect(recent.distancePerWeek).toBeCloseTo(18_000 / 4, 5);
    // All time runs from the first activity (1 Jun 2025) to now: more than 60 weeks.
    expect(allTime.distancePerWeek).toBeLessThan(46_000 / 60);
    expect(allTime.distancePerWeek).toBeGreaterThan(0);
  });

  it('averages time, climb and number of activities per week the same way', () => {
    const { recent } = periodStats(activities, NOW);

    expect(recent.durationPerWeek).toBeCloseTo(recent.duration / 4, 5);
    expect(recent.elevationPerWeek).toBeCloseTo(recent.elevation / 4, 5);
    expect(recent.activitiesPerWeek).toBeCloseTo(recent.count / 4, 5);
  });

  it('is all zeros with no activities, never NaN', () => {
    const stats = periodStats([], NOW);

    for (const period of [stats.recent, stats.thisMonth, stats.thisYear, stats.allTime]) {
      expect(period).toEqual({
        count: 0,
        distance: 0,
        duration: 0,
        elevation: 0,
        activeDays: 0,
        distancePerWeek: 0,
        durationPerWeek: 0,
        elevationPerWeek: 0,
        activitiesPerWeek: 0,
      });
    }
  });

  it('leaves out activities in the future and treats a missing elevation as zero', () => {
    const stats = periodStats(
      [act('2026-11-30T07:00:00', 9999), act('2026-10-20T07:00:00', 1000)],
      NOW
    );

    expect(stats.allTime.count).toBe(1);
    expect(stats.allTime.elevation).toBe(0);
  });
});

describe('sportsDone', () => {
  it('lists the sports with activities, most done first', () => {
    const list = sportsDone([
      act('2026-10-01T07:00:00', 1, 1, { activityType: 'ride' }),
      act('2026-10-02T07:00:00', 1, 1),
      act('2026-10-03T07:00:00', 1, 1),
    ]);

    expect(list).toEqual(['run', 'ride']);
  });
});

describe('sportBreakdown', () => {
  const list = [
    act('2026-10-01T07:00:00', 5000, 1_800_000),
    act('2026-10-02T07:00:00', 3000, 900_000),
    act('2026-10-03T07:00:00', 40_000, 5_400_000, { activityType: 'ride' }),
  ];

  it('totals each sport, the one with the most distance first', () => {
    expect(sportBreakdown(list)).toEqual([
      { sport: 'ride', count: 1, distance: 40_000, duration: 5_400_000 },
      { sport: 'run', count: 2, distance: 8000, duration: 2_700_000 },
    ]);
  });

  it('is empty without activities', () => {
    expect(sportBreakdown([])).toEqual([]);
  });
});
