import { describe, expect, it, vi } from 'vitest';
import type { Activity, ActivityStream } from '@/types';
import { activityResults, fastestWindowStart, recordPins } from '@/utils/activityResults';

vi.mock('@/constants/theme', () => ({
  AchievementColors: {
    green: '#34C759',
    orange: '#FF9500',
    yellow: '#FFD60A',
    blue: '#007AFF',
    indigo: '#5856D6',
    purple: '#AF52DE',
    red: '#FF3B30',
  },
}));

const make = (id: string, day: number, over: Partial<Activity> = {}): Activity =>
  ({
    id,
    userId: 'me',
    activityType: 'run',
    distance: 6000,
    duration: 1_800_000,
    territory: null,
    territoryArea: 0,
    createdAt: new Date(Date.UTC(2026, 9, day)),
    ...over,
  }) as Activity;

describe('activityResults', () => {
  const older = make('old', 1, {
    distance: 5000,
    duration: 1_700_000,
    bestEfforts: [{ distance: 5000, movingTime: 1_700_000 }],
  });
  const newer = make('new', 5, {
    distance: 6000,
    duration: 1_800_000,
    bestEfforts: [
      { distance: 1000, movingTime: 300_000 },
      { distance: 5000, movingTime: 1_500_000 },
    ],
  });

  it('counts best efforts and lists the records this activity set with their values', () => {
    const r = activityResults(newer, [older, newer], 'metric');
    expect(r.bestEffortCount).toBe(2);
    expect(r.records.map((x) => x.kind)).toContain('fastest-5k');
    expect(r.records.find((x) => x.kind === 'fastest-5k')).toMatchObject({
      label: 'Fastest 5 km',
      stat: '25m 0s',
    });
    expect(r.records.some((x) => x.kind === 'fastest-5k' && x.activityId !== 'new')).toBe(false);
  });

  it('lists the achievements this activity earned', () => {
    const r = activityResults(older, [older], 'metric');
    expect(r.achievements.map((a) => a.id)).toContain('first_activity');
  });

  it('claims no records for a first activity, which holds them all by default', () => {
    expect(activityResults(older, [older], 'metric').records).toEqual([]);
  });

  it('only compares like with like', () => {
    const ride = make('ride', 9, { activityType: 'ride', distance: 50_000 });
    expect(activityResults(newer, [older, newer, ride], 'metric').records.length).toBeGreaterThan(
      0
    );
    expect(activityResults(ride, [older, newer, ride], 'metric').records).toEqual([]);
  });

  it('is empty-handed for an activity with nothing to show', () => {
    const bare = make('bare', 2);
    const r = activityResults(
      bare,
      [bare, make('other', 3, { distance: 9000, duration: 9e6 })],
      'metric'
    );
    expect(r.bestEffortCount).toBe(0);
    expect(r.records).toEqual([]);
  });
});

describe('fastestWindowStart', () => {
  // 100 m every 10 s, except 100 m to 300 m covered at 100 m every 5 s.
  const stream: ActivityStream = {
    t: [0, 10, 20, 30, 35, 40, 50, 60],
    d: [0, 100, 200, 300, 400, 500, 600, 700],
    speed: [],
  };

  it('finds where the fastest stretch of a distance begins', () => {
    expect(fastestWindowStart({ ...stream, t: [0, 10, 20, 25, 30, 40, 50, 60] }, 200)).toBe(200);
  });

  it('is null without distances, or when the distance was never covered', () => {
    expect(fastestWindowStart({ ...stream, d: undefined }, 200)).toBeNull();
    expect(fastestWindowStart(stream, 5000)).toBeNull();
  });
});

describe('recordPins', () => {
  const line: [number, number][] = [
    [0, 0],
    [0, 0.01],
  ];
  const stream: ActivityStream = {
    t: [0, 10, 20, 30],
    d: [0, 250, 500, 750],
    speed: [],
  };

  it('places a pin for each fastest-effort record that the stream can locate', () => {
    const pins = recordPins(['fastest-400m', 'longest-distance'], stream, line);
    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({ id: 'fastest-400m', label: '400' });
  });

  it('places none without a route or distances', () => {
    expect(recordPins(['fastest-400m'], stream, [])).toEqual([]);
    expect(recordPins(['fastest-400m'], undefined, line)).toEqual([]);
  });
});
