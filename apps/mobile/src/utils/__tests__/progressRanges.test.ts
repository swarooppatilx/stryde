import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import { chartBuckets, sportBreakdown } from '@/utils/progressRanges';

const make = (patch: Partial<Activity>): Activity =>
  ({
    id: 'a',
    userId: 'u',
    activityType: 'run',
    distance: 1000,
    duration: 600_000,
    polyline: '',
    territory: null,
    territoryArea: 0,
    createdAt: new Date(2026, 10, 3, 9),
    ...patch,
  }) as Activity;

const now = new Date(2026, 10, 3, 12);

describe('chartBuckets', () => {
  it('weeks gives the last twelve, ending with this one', () => {
    const view = chartBuckets([make({})], 'weeks', now, 0);
    expect(view.buckets).toHaveLength(12);
    expect(view.currentIndex).toBe(11);
    expect(view.buckets[11]?.distance).toBe(1000);
  });

  it('month gives one bar per day of the calendar month, with today marked', () => {
    const view = chartBuckets(
      [make({}), make({ id: 'b', createdAt: new Date(2026, 10, 1), distance: 500 })],
      'month',
      now,
      0
    );
    expect(view.buckets).toHaveLength(30);
    expect(view.currentIndex).toBe(2);
    expect(view.buckets[0]?.distance).toBe(500);
    expect(view.buckets[2]?.count).toBe(1);
  });

  it('year gives twelve months and drops other years', () => {
    const view = chartBuckets(
      [
        make({}),
        make({ id: 'b', createdAt: new Date(2026, 0, 31), distance: 700 }),
        make({ id: 'c', createdAt: new Date(2025, 10, 3) }),
      ],
      'year',
      now,
      0
    );
    expect(view.buckets).toHaveLength(12);
    expect(view.currentIndex).toBe(10);
    expect(view.buckets[0]?.distance).toBe(700);
    expect(view.buckets[10]?.distance).toBe(1000);
  });

  it('labels bars so a month does not crowd its axis', () => {
    const month = chartBuckets([], 'month', now, 0);
    expect(month.buckets.map((_, i) => month.label(i)).filter(Boolean)).toEqual([
      '1',
      '5',
      '10',
      '15',
      '20',
      '25',
      '30',
    ]);
    const year = chartBuckets([], 'year', now, 0);
    expect(year.label(0)).toBe('J');
    expect(year.label(11)).toBe('D');
  });
});

describe('sportBreakdown', () => {
  it('splits the range by sport, most distance first, with shares of the largest', () => {
    const list = [
      make({ id: '1', distance: 4000 }),
      make({ id: '2', activityType: 'ride', distance: 8000 }),
      make({ id: '3', activityType: 'ride', distance: 2000 }),
      make({ id: '4', createdAt: new Date(2026, 5, 1), distance: 99_000 }),
    ];
    const rows = sportBreakdown(list, 'month', now, 0);
    expect(rows.map((r) => [r.sport, r.distance, r.count])).toEqual([
      ['ride', 10_000, 2],
      ['run', 4000, 1],
    ]);
    expect(rows[0]?.share).toBe(1);
    expect(rows[1]?.share).toBeCloseTo(0.4);
  });

  it('is empty when nothing was done in the range', () => {
    expect(sportBreakdown([], 'year', now, 0)).toEqual([]);
  });
});
