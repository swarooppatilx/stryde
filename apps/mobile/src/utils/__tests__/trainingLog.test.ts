import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import {
  bestWeek,
  filterBySport,
  monthCalendar,
  periodTotals,
  weekdayLabels,
  weeklyBuckets,
  weekStart,
} from '@/utils/trainingLog';

const activity = (iso: string, distance = 5000, duration = 1_800_000): Activity =>
  ({
    id: iso,
    userId: 'u',
    activityType: 'run',
    distance,
    duration,
    polyline: '',
    territory: null,
    territoryArea: 0,
    createdAt: new Date(iso),
  }) as Activity;

// Local-time dates, because weeks and days are the athlete's own.
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
// Sunday 18 Oct 2026 is the start of the current week in these tests (weeks start on Sunday, as the weekly card does).
const NOW = new Date(2026, 9, 21, 9); // Wednesday 21 Oct 2026

describe('weeklyBuckets', () => {
  it('gives the requested number of weeks, oldest first, ending with the current one', () => {
    const buckets = weeklyBuckets([], 4, NOW);

    expect(buckets).toHaveLength(4);
    expect(buckets.map((b) => b.start.getDate())).toEqual([27, 4, 11, 18]);
    expect(buckets[3]?.start.getDay()).toBe(0);
  });

  it('puts each activity in its own week and adds up the totals', () => {
    const buckets = weeklyBuckets(
      [
        activity(local(2026, 10, 19), 5000, 1_500_000), // this week (Mon)
        activity(local(2026, 10, 20), 3000, 900_000), // this week (Tue)
        activity(local(2026, 10, 13), 10_000, 3_000_000), // last week
      ],
      4,
      NOW
    );

    expect(buckets[3]).toMatchObject({ count: 2, distance: 8000, duration: 2_400_000 });
    expect(buckets[2]).toMatchObject({ count: 1, distance: 10_000 });
    expect(buckets[1]).toMatchObject({ count: 0, distance: 0 });
  });

  it('starts a new week at midnight on Sunday', () => {
    const [previous, current] = weeklyBuckets(
      [
        activity(new Date(2026, 9, 17, 23, 59).toISOString()), // Saturday night
        activity(new Date(2026, 9, 18, 0, 1).toISOString()), // Sunday just after midnight
      ],
      2,
      NOW
    );

    expect(previous?.count).toBe(1);
    expect(current?.count).toBe(1);
  });

  it('ignores activities older than the window', () => {
    const buckets = weeklyBuckets([activity(local(2025, 1, 5))], 4, NOW);

    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(0);
  });
});

describe('monthCalendar', () => {
  it('lays October 2026 out Sunday-first, with blanks before the 1st (a Thursday)', () => {
    const { weeks } = monthCalendar([], 2026, 9);

    expect(weeks[0]?.slice(0, 4).every((cell) => cell === null)).toBe(true);
    expect(weeks[0]?.[4]?.day).toBe(1);
    const days = weeks.flat().filter((cell) => cell !== null);
    expect(days).toHaveLength(31);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('marks the days with activity, with their counts and distance', () => {
    const { weeks } = monthCalendar(
      [
        activity(local(2026, 10, 12), 4000),
        activity(local(2026, 10, 12), 6000),
        activity(local(2026, 10, 30), 2000),
        activity(local(2026, 9, 30), 9999), // another month
      ],
      2026,
      9
    );

    const byDay = new Map(weeks.flat().flatMap((c) => (c ? [[c.day, c] as const] : [])));
    expect(byDay.get(12)).toMatchObject({ count: 2, distance: 10_000 });
    expect(byDay.get(30)).toMatchObject({ count: 1, distance: 2000 });
    expect(byDay.get(13)).toMatchObject({ count: 0, distance: 0 });
  });

  it('handles a month that starts on a Sunday with no leading blanks', () => {
    // 1 Feb 2026 is a Sunday.
    const { weeks } = monthCalendar([], 2026, 1);

    expect(weeks[0]?.[0]?.day).toBe(1);
    expect(weeks.flat().filter((c) => c !== null)).toHaveLength(28);
  });
});

describe('periodTotals', () => {
  it('sums this month and this year, not other months or years', () => {
    const totals = periodTotals(
      [
        activity(local(2026, 10, 2), 5000, 1_000_000),
        activity(local(2026, 10, 19), 3000, 600_000),
        activity(local(2026, 3, 1), 10_000, 4_000_000),
        activity(local(2025, 12, 31), 99_000, 9_000_000),
      ],
      NOW
    );

    expect(totals.month).toEqual({ count: 2, distance: 8000, duration: 1_600_000 });
    expect(totals.year).toEqual({ count: 3, distance: 18_000, duration: 5_600_000 });
  });
});

describe('filterBySport', () => {
  const list = [
    { ...activity('2026-10-01'), activityType: 'run' },
    { ...activity('2026-10-02'), activityType: 'ride' },
    { ...activity('2026-10-03'), activityType: 'run' },
  ] as Activity[];

  it('keeps everything for "all"', () => {
    expect(filterBySport(list, 'all')).toBe(list);
  });

  it('keeps only the chosen sport', () => {
    expect(filterBySport(list, 'run').map((a) => a.id)).toEqual(['2026-10-01', '2026-10-03']);
    expect(filterBySport(list, 'swim')).toEqual([]);
  });
});

describe('bestWeek', () => {
  it('is nothing without activities', () => {
    expect(bestWeek([])).toBeNull();
  });

  it('finds the Sunday-to-Saturday week with the most distance, and what was done in it', () => {
    const best = bestWeek([
      activity('2026-10-05T07:00:00', 5000), // Mon of week A
      activity('2026-10-07T07:00:00', 4000), // Wed of week A
      activity('2026-10-13T07:00:00', 12_000), // Tue of week B (the next week)
    ]);

    expect(best?.distance).toBe(12_000);
    expect(best?.count).toBe(1);
    expect(best?.start.getDay()).toBe(0);
    expect(best?.start.getDate()).toBe(11);
  });

  it('keeps the earlier week when two tie', () => {
    const best = bestWeek([
      activity('2026-10-13T07:00:00', 8000),
      activity('2026-10-06T07:00:00', 8000),
    ]);

    expect(best?.start.getDate()).toBe(4);
  });
});

describe('weeks that start on Monday', () => {
  it('starts a week at midnight on the Monday on or before the date', () => {
    expect(weekStart(new Date(2026, 9, 21, 9), 1).getDate()).toBe(19); // Wed 21 Oct -> Mon 19 Oct
    expect(weekStart(new Date(2026, 9, 18, 9), 1).getDate()).toBe(12); // Sun 18 Oct belongs to the week of Mon 12 Oct
    expect(weekStart(new Date(2026, 9, 19, 0, 30), 1).getHours()).toBe(0);
  });

  it('keeps Sunday as the default start', () => {
    expect(weekStart(new Date(2026, 9, 21, 9)).getDate()).toBe(18);
  });

  it('puts a Sunday run in the previous Monday-based week', () => {
    const buckets = weeklyBuckets([activity(local(2026, 10, 18))], 2, NOW, 1);
    expect(buckets[0]?.count).toBe(1); // week of Mon 12 Oct
    expect(buckets[1]?.count).toBe(0); // week of Mon 19 Oct
  });

  it('pads a month calendar to the Monday column', () => {
    // 1 Oct 2026 is a Thursday: three empty cells before it when weeks start on Monday, four on Sunday.
    expect(monthCalendar([], 2026, 9, 1).weeks[0]?.filter((c) => c === null)).toHaveLength(3);
    expect(monthCalendar([], 2026, 9).weeks[0]?.filter((c) => c === null)).toHaveLength(4);
  });

  it('finds the best Monday-to-Sunday week', () => {
    const best = bestWeek(
      [activity('2026-10-17T07:00:00', 5000), activity('2026-10-18T07:00:00', 6000)],
      1
    );
    expect(best?.distance).toBe(11_000); // Sat 17 and Sun 18 share the week of Mon 12 Oct
    expect(best?.start.getDay()).toBe(1);
  });
});

describe('weekdayLabels', () => {
  it('lists the days from the start day', () => {
    expect(weekdayLabels(0)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(weekdayLabels(1)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });
});
