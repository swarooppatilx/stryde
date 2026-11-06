import { describe, expect, it } from 'vitest';
import type { ActivityStream, ActivityType } from '@/types';
import {
  activityStats,
  applyHiddenStats,
  isStatHidden,
  parseHiddenStats,
  sportFamily,
  sportStatSet,
} from '@/utils/activityStats';

const run = (over: Partial<Parameters<typeof activityStats>[0]> = {}) => ({
  activityType: 'run' as ActivityType,
  distance: 5000,
  duration: 1_800_000,
  ...over,
});

const labels = (stats: ReturnType<typeof activityStats>) => stats.map((s) => s.label);

describe('activityStats', () => {
  it('lists distance, pace and time for a run', () => {
    expect(activityStats(run(), 'metric')).toEqual([
      { label: 'Distance', value: '5.00km' },
      { label: 'Pace', value: '6:00/km' },
      { label: 'Time', value: '30m 0s' },
    ]);
  });

  it('shows speed, not pace, for a ride', () => {
    const stats = activityStats(run({ activityType: 'ride' }), 'metric');
    expect(labels(stats)).toEqual(['Distance', 'Speed', 'Time']);
  });

  it('adds elevation only when there was a climb', () => {
    expect(labels(activityStats(run({ elevationGain: 42 }), 'metric'))).toContain('Elevation');
    expect(labels(activityStats(run({ elevationGain: 0 }), 'metric'))).not.toContain('Elevation');
    expect(labels(activityStats(run({ elevationGain: undefined }), 'metric'))).not.toContain(
      'Elevation'
    );
  });

  it('reads pedometer cadence as avg–max spm after the time rows', () => {
    const stream: ActivityStream = {
      t: [0, 1],
      speed: [2, 2],
      startedAt: 0,
      cadence: { t: [2, 4, 6], spm: [0, 150, 160] },
    };
    const stats = activityStats(run({ stream, duration: 600_000 }), 'metric');
    expect(stats[3]).toEqual({ label: 'Cadence', value: '155–160 spm' });
  });

  it('shows no cadence for a still pedometer or a manual entry', () => {
    // All-zero windows average to a useless number; leaving the row out says more.
    expect(
      labels(
        activityStats(
          run({ stream: { t: [0], speed: [0], cadence: { t: [2, 4], spm: [0, 0] } } }),
          'metric'
        )
      )
    ).not.toContain('Cadence');
    expect(labels(activityStats(run(), 'metric'))).not.toContain('Cadence');
  });

  it('leaves out what a sport without distance cannot have', () => {
    const stats = activityStats(run({ activityType: 'yoga', distance: 0 }), 'metric');
    expect(labels(stats)).toEqual(['Time']);
  });

  it('keeps distance but drops pace when there is no time', () => {
    expect(labels(activityStats(run({ duration: 0 }), 'metric'))).toEqual(['Distance']);
  });

  it('uses the athlete’s units', () => {
    const stats = activityStats(run(), 'imperial');
    expect(stats[0]?.value).toBe('3.11mi');
    expect(stats[1]?.value).toMatch(/\/mi$/);
  });

  it('splits time into moving and elapsed when the athlete stopped for a while', () => {
    const stats = activityStats(
      { activityType: 'run', distance: 5000, duration: 1_500_000, elapsed: 1_800_000 },
      'metric'
    );

    expect(stats.map((s) => s.label)).toEqual(['Distance', 'Pace', 'Moving time', 'Elapsed time']);
  });

  it('keeps a single Time when the pauses were negligible', () => {
    const stats = activityStats(
      { activityType: 'run', distance: 5000, duration: 1_500_000, elapsed: 1_503_000 },
      'metric'
    );

    expect(stats.map((s) => s.label)).toEqual(['Distance', 'Pace', 'Time']);
  });

  it('adds calories only when there is an estimate', () => {
    const base = { activityType: 'run' as const, distance: 5000, duration: 1_500_000 };

    expect(activityStats({ ...base, calories: 362 }, 'metric').at(-1)).toEqual({
      label: 'Calories',
      value: '362 kcal',
    });
    expect(activityStats({ ...base, calories: null }, 'metric').map((s) => s.label)).not.toContain(
      'Calories'
    );
  });

  it('shows heart rate as average to peak only when a device measured it', () => {
    const base = { activityType: 'run' as const, distance: 5000, duration: 1_500_000 };
    const labels = (heartRate?: { avg: number; max: number } | null) =>
      activityStats({ ...base, heartRate }, 'metric').map((s) => s.label);
    expect(labels({ avg: 148, max: 171 })).toContain('Heart rate');
    expect(labels(undefined)).not.toContain('Heart rate');
    expect(labels(null)).not.toContain('Heart rate');
    expect(
      activityStats({ ...base, heartRate: { avg: 148, max: 171 } }, 'metric').find(
        (s) => s.label === 'Heart rate'
      )?.value
    ).toBe('148–171 bpm');
  });
});

describe('sportFamily', () => {
  it('groups sports by the figures they are judged on', () => {
    expect(['run', 'walk', 'hike'].map((s) => sportFamily(s as ActivityType))).toEqual([
      'foot',
      'foot',
      'foot',
    ]);
    expect(sportFamily('ride')).toBe('cycle');
    expect(sportFamily('swim')).toBe('water');
    expect(sportFamily('row')).toBe('water');
    expect(sportFamily('yoga')).toBe('other');
    expect(sportFamily('climb')).toBe('other');
  });
});

describe('sportStatSet', () => {
  const stream: ActivityStream = {
    t: [0, 1],
    speed: [2, 2],
    startedAt: 0,
    cadence: { t: [0, 1], spm: [160, 170] },
  };
  const full = {
    distance: 5000,
    duration: 1_800_000,
    elevationGain: 42,
    stream,
    heartRate: { avg: 140, max: 170 },
    calories: 300,
  };

  it('gives a foot sport distance, pace, time, elevation and cadence, in that order', () => {
    const stats = sportStatSet({ ...full, activityType: 'run' }, 'metric');
    expect(labels(stats)).toEqual([
      'Distance',
      'Pace',
      'Time',
      'Elevation',
      'Cadence',
      'Heart rate',
      'Calories',
    ]);
  });

  it('leaves cadence out when the pedometer gave none', () => {
    const stats = sportStatSet({ ...full, stream: undefined, activityType: 'hike' }, 'metric');
    expect(labels(stats)).not.toContain('Cadence');
  });

  it('gives a ride speed and elevation but no cadence', () => {
    const stats = sportStatSet({ ...full, activityType: 'ride' }, 'metric');
    expect(labels(stats)).toEqual([
      'Distance',
      'Speed',
      'Time',
      'Elevation',
      'Heart rate',
      'Calories',
    ]);
  });

  it('gives water sports and the rest only distance and time, plus what a device measured', () => {
    expect(labels(sportStatSet({ ...full, activityType: 'swim' }, 'metric'))).toEqual([
      'Distance',
      'Time',
      'Heart rate',
      'Calories',
    ]);
    expect(labels(sportStatSet({ ...full, activityType: 'yoga', distance: 0 }, 'metric'))).toEqual([
      'Time',
      'Heart rate',
      'Calories',
    ]);
  });

  it('keeps moving and elapsed time for a run with a long stop', () => {
    const stats = sportStatSet(
      { activityType: 'run', distance: 5000, duration: 1_500_000, elapsed: 1_800_000 },
      'metric'
    );
    expect(labels(stats)).toEqual(['Distance', 'Pace', 'Moving time', 'Elapsed time']);
  });
});

describe('max elevation', () => {
  const stat = (over: Partial<Parameters<typeof activityStats>[0]>) =>
    activityStats(run({ elevationGain: 42, ...over }), 'metric').find(
      (s) => s.label === 'Max elevation'
    );

  it('shows the highest point when it is known', () => {
    expect(stat({ maxElevation: 561 })?.value).toBe('561m');
  });

  it('shows 0 for a route at sea level, since that is a real reading', () => {
    expect(stat({ maxElevation: 0 })?.value).toBe('0m');
  });

  it('leaves it out when there is no reading', () => {
    expect(stat({ maxElevation: undefined })).toBeUndefined();
    expect(stat({ maxElevation: null })).toBeUndefined();
  });

  it('uses the athlete’s units', () => {
    const feet = activityStats(run({ elevationGain: 42, maxElevation: 100 }), 'imperial');

    expect(feet.find((s) => s.label === 'Max elevation')?.value).toMatch(/ft/);
  });
});

describe('applyHiddenStats', () => {
  const stats = activityStats(run(), 'metric');

  it('drops pace for other people when the author hid it', () => {
    expect(labels(applyHiddenStats(stats, ['pace'], false))).toEqual(['Distance', 'Time']);
  });

  it('drops speed too, since it is the same figure for a ride', () => {
    const ride = activityStats(run({ activityType: 'ride' }), 'metric');
    expect(labels(ride)).toContain('Speed');
    expect(labels(applyHiddenStats(ride, ['pace'], false))).not.toContain('Speed');
  });

  it('never hides anything from the owner', () => {
    expect(applyHiddenStats(stats, ['pace'], true)).toEqual(stats);
  });

  it('leaves the stats alone when nothing is hidden', () => {
    expect(applyHiddenStats(stats, undefined, false)).toEqual(stats);
    expect(applyHiddenStats(stats, [], false)).toEqual(stats);
  });

  it('does not touch the stats when only the start time is hidden', () => {
    expect(applyHiddenStats(stats, ['start_time'], false)).toEqual(stats);
  });
});

describe('isStatHidden', () => {
  it('is true only for another viewer and a hidden stat', () => {
    expect(isStatHidden('start_time', ['start_time'], false)).toBe(true);
    expect(isStatHidden('start_time', ['start_time'], true)).toBe(false);
    expect(isStatHidden('pace', ['start_time'], false)).toBe(false);
    expect(isStatHidden('pace', undefined, false)).toBe(false);
  });
});

describe('parseHiddenStats', () => {
  it('keeps the stats the app knows, once each, and gives undefined for none', () => {
    expect(parseHiddenStats(['pace', 'pace', 'start_time', 'heart_rate'])).toEqual([
      'pace',
      'start_time',
    ]);
    expect(parseHiddenStats(['heart_rate'])).toBeUndefined();
    expect(parseHiddenStats(undefined)).toBeUndefined();
  });
});
