import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import { personalRecords, recordsHeldBy } from '@/utils/personalRecords';

const make = (id: string, over: Partial<Activity>): Activity =>
  ({
    id,
    userId: '0xme',
    activityType: 'run',
    distance: 5000,
    duration: 1_800_000,
    territory: null,
    territoryArea: 0,
    createdAt: new Date('2026-10-01'),
    ...over,
  }) as Activity;

describe('personalRecords', () => {
  it('has nothing to show without activities', () => {
    expect(personalRecords([])).toEqual([]);
  });

  it('finds the longest distance and the longest time, each with its activity', () => {
    const records = personalRecords([
      make('a', { distance: 5000, duration: 1_500_000 }),
      make('b', { distance: 12_000, duration: 4_000_000 }),
      make('c', { distance: 8000, duration: 5_000_000 }),
    ]);

    expect(records.find((r) => r.kind === 'longest-distance')).toMatchObject({
      activityId: 'b',
      value: 12_000,
    });
    expect(records.find((r) => r.kind === 'longest-time')).toMatchObject({
      activityId: 'c',
      value: 5_000_000,
    });
  });

  it('finds the biggest climb, only when something was climbed', () => {
    expect(personalRecords([make('a', {})]).some((r) => r.kind === 'biggest-climb')).toBe(false);
    const records = personalRecords([
      make('a', { elevationGain: 40 }),
      make('b', { elevationGain: 220 }),
    ]);
    expect(records.find((r) => r.kind === 'biggest-climb')).toMatchObject({
      activityId: 'b',
      value: 220,
    });
  });

  it('finds the fastest 1 km, 5 km and 10 km across activities', () => {
    const records = personalRecords([
      make('a', { bestEfforts: [{ distance: 1000, movingTime: 300_000 }] }),
      make('b', {
        bestEfforts: [
          { distance: 1000, movingTime: 280_000 },
          { distance: 5000, movingTime: 1_500_000 },
        ],
      }),
    ]);

    expect(records.find((r) => r.kind === 'fastest-1k')).toMatchObject({
      activityId: 'b',
      value: 280_000,
    });
    expect(records.find((r) => r.kind === 'fastest-5k')).toMatchObject({ activityId: 'b' });
    expect(records.some((r) => r.kind === 'fastest-10k')).toBe(false);
  });

  it('finds the fastest mile, half marathon and marathon from the wider efforts', () => {
    const records = personalRecords([
      make('long', {
        distance: 43_000,
        duration: 14_400_000,
        bestEfforts: [
          { distance: 400, movingTime: 90_000 },
          { distance: 1609, movingTime: 450_000 },
          { distance: 21_097, movingTime: 6_300_000 },
          { distance: 42_195, movingTime: 14_000_000 },
        ],
      }),
    ]);

    const kinds = records.map((r) => r.kind);
    expect(kinds).toEqual([
      'fastest-400m',
      'fastest-1mile',
      'fastest-half',
      'fastest-marathon',
      'longest-distance',
      'longest-time',
    ]);
    expect(records.find((r) => r.kind === 'fastest-1mile')?.value).toBe(450_000);
  });

  it('keeps the next two best times of a distance, one per activity, as runners-up', () => {
    const effort = (movingTime: number) => ({ distance: 5000, movingTime });
    const records = personalRecords([
      make('a', { bestEfforts: [effort(1_500_000)], createdAt: new Date('2026-10-01') }),
      make('b', { bestEfforts: [effort(1_450_000)], createdAt: new Date('2026-10-02') }),
      make('c', { bestEfforts: [effort(1_520_000)], createdAt: new Date('2026-10-03') }),
      make('d', { bestEfforts: [effort(1_600_000)], createdAt: new Date('2026-10-04') }),
    ]);

    const five = records.find((r) => r.kind === 'fastest-5k');
    expect(five?.value).toBe(1_450_000);
    expect(five?.runnersUp?.map((r) => [r.activityId, r.value])).toEqual([
      ['a', 1_500_000],
      ['c', 1_520_000],
    ]);
  });

  it('has no runners-up with a single effort, and none for distance or climb records', () => {
    const records = personalRecords([
      make('a', { bestEfforts: [{ distance: 5000, movingTime: 1_500_000 }], elevationGain: 80 }),
    ]);

    expect(records.find((r) => r.kind === 'fastest-5k')?.runnersUp).toBeUndefined();
    expect(records.find((r) => r.kind === 'longest-distance')?.runnersUp).toBeUndefined();
    expect(records.find((r) => r.kind === 'biggest-climb')?.runnersUp).toBeUndefined();
  });

  it('ignores impossible efforts attached to a short walk', () => {
    const records = personalRecords([
      make('bad-walk', {
        activityType: 'walk',
        distance: 425,
        bestEfforts: [{ distance: 1000, movingTime: 206_000 }],
      }),
    ]);

    expect(records.some((r) => r.kind === 'fastest-1k')).toBe(false);
  });

  it('leaves out entries typed in by hand, which anyone could make up', () => {
    const records = personalRecords([
      make('hand', { distance: 90_000, isManual: true }),
      make('gps', { distance: 5000 }),
    ]);

    expect(records.find((r) => r.kind === 'longest-distance')?.activityId).toBe('gps');
  });

  it('leaves out activities recorded with a simulated location, like entries typed by hand', () => {
    const records = personalRecords([
      make('fake', { distance: 90_000, mocked: true } as never),
      make('real', { distance: 5000 }),
    ]);

    expect(records.find((r) => r.kind === 'longest-distance')?.activityId).toBe('real');
  });

  it('keeps the earlier activity when two tie', () => {
    const records = personalRecords([
      make('late', { distance: 5000, createdAt: new Date('2026-10-05') }),
      make('early', { distance: 5000, createdAt: new Date('2026-10-01') }),
    ]);

    expect(records.find((r) => r.kind === 'longest-distance')?.activityId).toBe('early');
  });
});

describe('recordsHeldBy', () => {
  it('lists the records an activity holds, in the usual order', () => {
    const list = [
      make('a', { distance: 5000, duration: 1_500_000 }),
      make('b', { distance: 12_000, duration: 4_000_000, elevationGain: 90 }),
    ];

    expect(recordsHeldBy(personalRecords(list), 'b')).toEqual([
      'longest-distance',
      'longest-time',
      'biggest-climb',
    ]);
    expect(recordsHeldBy(personalRecords(list), 'a')).toEqual([]);
  });

  it('says nothing for an activity that is the only one (a first run is not a record to boast about)', () => {
    expect(recordsHeldBy(personalRecords([make('only', {})]), 'only', 1)).toEqual([]);
  });
});
