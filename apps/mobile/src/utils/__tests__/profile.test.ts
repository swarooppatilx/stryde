import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import { computePersonalRecords, computeStreak, filterBySport } from '@/utils/profile';

function makeActivity(overrides: Partial<Activity> & Pick<Activity, 'id' | 'createdAt'>): Activity {
  return {
    userId: 'user1',
    activityType: 'run',
    distance: 5000,
    duration: 1800_000,
    polyline: '',
    territory: null,
    territoryArea: 0,
    ...overrides,
  } as Activity;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

describe('computeStreak', () => {
  it('returns 0/0 for empty array', () => {
    expect(computeStreak([])).toEqual({ current: 0, longest: 0 });
  });

  it('returns current=1 for single day (today or yesterday)', () => {
    const result = computeStreak([makeActivity({ id: '1', createdAt: new Date() })]);
    expect(result.current).toBeGreaterThanOrEqual(1);
  });

  it('computes consecutive day streak', () => {
    const activities = [
      makeActivity({ id: '1', createdAt: daysAgo(0) }),
      makeActivity({ id: '2', createdAt: daysAgo(1) }),
      makeActivity({ id: '3', createdAt: daysAgo(2) }),
    ];
    const result = computeStreak(activities);
    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
  });

  it('computes longest streak across a gap', () => {
    const activities = [
      makeActivity({ id: '1', createdAt: daysAgo(0) }),
      makeActivity({ id: '2', createdAt: daysAgo(1) }),
      // gap at day 2
      makeActivity({ id: '3', createdAt: daysAgo(3) }),
      makeActivity({ id: '4', createdAt: daysAgo(4) }),
      makeActivity({ id: '5', createdAt: daysAgo(5) }),
    ];
    const result = computeStreak(activities);
    expect(result.longest).toBe(3);
  });

  it('deduplicates same-day activities', () => {
    const today = daysAgo(0);
    const activities = [
      makeActivity({ id: '1', createdAt: today }),
      makeActivity({ id: '2', createdAt: new Date(today.getTime() + 3600_000) }),
    ];
    const result = computeStreak(activities);
    expect(result.current).toBe(1);
  });
});

describe('filterBySport', () => {
  const run = makeActivity({ id: 'r', createdAt: new Date(), activityType: 'run' });
  const ride = makeActivity({ id: 'b', createdAt: new Date(), activityType: 'ride' });

  it('keeps everything for "all"', () => {
    expect(filterBySport([run, ride], 'all')).toEqual([run, ride]);
  });

  it('keeps only the chosen sport, in the same order', () => {
    const run2 = makeActivity({ id: 'r2', createdAt: new Date(), activityType: 'run' });

    expect(filterBySport([run, ride, run2], 'run')).toEqual([run, run2]);
    expect(filterBySport([run, ride], 'swim')).toEqual([]);
  });
});

describe('computePersonalRecords', () => {
  it('returns all nulls for empty array', () => {
    const result = computePersonalRecords([]);
    expect(result.longestDistance).toBeNull();
    expect(result.fastestPace).toBeNull();
    expect(result.largestTerritory).toBeNull();
    expect(result.longestDuration).toBeNull();
  });

  it('returns the activity itself for single entry', () => {
    const a = makeActivity({ id: '1', createdAt: new Date(), distance: 5000, duration: 1800_000 });
    const result = computePersonalRecords([a]);
    expect(result.longestDistance).toBe(a);
    expect(result.fastestPace).toBe(a);
    expect(result.largestTerritory).toBe(a);
    expect(result.longestDuration).toBe(a);
  });

  it('picks correct records from multiple activities', () => {
    const a1 = makeActivity({
      id: '1',
      createdAt: new Date(),
      distance: 1000,
      duration: 600_000,
      territoryArea: 100,
    });
    const a2 = makeActivity({
      id: '2',
      createdAt: new Date(),
      distance: 5000,
      duration: 1800_000,
      territoryArea: 500,
    });
    const a3 = makeActivity({
      id: '3',
      createdAt: new Date(),
      distance: 3000,
      duration: 900_000,
      territoryArea: 1000,
    });
    const result = computePersonalRecords([a1, a2, a3]);
    expect(result.longestDistance).toBe(a2);
    expect(result.largestTerritory).toBe(a3);
    expect(result.longestDuration).toBe(a2);
  });

  it('does not let a bike ride, a typed-in entry or a sprint set the pace record', () => {
    const run = makeActivity({
      id: 'run',
      createdAt: new Date(),
      distance: 5000,
      duration: 1_500_000,
    }); // 5:00/km
    const ride = makeActivity({
      id: 'ride',
      createdAt: new Date(),
      activityType: 'ride',
      distance: 20_000,
      duration: 3_000_000, // 2:30/km
    });
    const typedIn = makeActivity({
      id: 'typed',
      createdAt: new Date(),
      distance: 10_000,
      duration: 1_200_000, // 2:00/km, typed by hand
      isManual: true,
    });
    const sprint = makeActivity({
      id: 'sprint',
      createdAt: new Date(),
      distance: 200,
      duration: 30_000,
    });

    expect(computePersonalRecords([ride, typedIn, sprint, run]).fastestPace).toBe(run);
  });

  it('has no pace record when nothing qualifies, rather than the first activity', () => {
    const ride = makeActivity({ id: 'ride', createdAt: new Date(), activityType: 'ride' });

    expect(computePersonalRecords([ride]).fastestPace).toBeNull();
  });

  it('keeps the quickest time ever recorded for each standard distance', () => {
    const early = makeActivity({
      id: 'early',
      createdAt: new Date(),
      bestEfforts: [
        { distance: 1000, movingTime: 280_000 },
        { distance: 5000, movingTime: 1_500_000 },
      ],
    });
    const later = makeActivity({
      id: 'later',
      createdAt: new Date(),
      distance: 10_000,
      bestEfforts: [
        { distance: 1000, movingTime: 260_000 },
        { distance: 10_000, movingTime: 3_200_000 },
      ],
    });
    const noEfforts = makeActivity({ id: 'plain', createdAt: new Date() });

    expect(computePersonalRecords([early, later, noEfforts]).bestEfforts).toEqual([
      { distance: 1000, movingTime: 260_000 },
      { distance: 5000, movingTime: 1_500_000 },
      { distance: 10_000, movingTime: 3_200_000 },
    ]);
  });

  it('has no best-effort records before any run has them', () => {
    expect(computePersonalRecords([]).bestEfforts).toEqual([]);
    expect(
      computePersonalRecords([makeActivity({ id: '1', createdAt: new Date() })]).bestEfforts
    ).toEqual([]);
  });

  it('does not include impossible efforts from short activities in profile records', () => {
    const result = computePersonalRecords([
      makeActivity({
        id: 'short-walk',
        createdAt: new Date(),
        activityType: 'walk',
        distance: 425,
        bestEfforts: [{ distance: 1000, movingTime: 206_000 }],
      }),
    ]);

    expect(result.bestEfforts).toEqual([]);
  });

  it('picks fastest pace correctly', () => {
    const slow = makeActivity({
      id: '1',
      createdAt: new Date(),
      distance: 1000,
      duration: 600_000,
    }); // 10 min/km
    const fast = makeActivity({
      id: '2',
      createdAt: new Date(),
      distance: 1000,
      duration: 300_000,
    }); // 5 min/km
    const result = computePersonalRecords([slow, fast]);
    expect(result.fastestPace).toBe(fast);
  });
});
