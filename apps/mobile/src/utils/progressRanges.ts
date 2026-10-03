import type { Activity, ActivityType } from '@/types';
import {
  type Totals,
  type WeekBucket,
  type WeekStartDay,
  weeklyBuckets,
  weekStart,
} from '@/utils/trainingLog';

export type ChartRange = 'weeks' | 'month' | 'year';

export const CHART_RANGES: readonly { value: ChartRange; label: string }[] = [
  { value: 'weeks', label: '12 weeks' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

export const WEEKS_SHOWN = 12;

const MONTH_INITIALS = 'JFMAMJJASOND';

export interface ChartView {
  /** Each bar's period and what was done in it; `start` is its first day. */
  buckets: WeekBucket[];
  /** The bar for the period holding today. */
  currentIndex: number;
  /** The text under a bar; blank where it would crowd its neighbours. */
  label(index: number): string;
  /** What one bar spans, for spoken descriptions. */
  unit: 'week' | 'day' | 'month';
  /** What the chart covers, for spoken descriptions. */
  span: string;
}

const empty = (): Totals => ({ count: 0, distance: 0, duration: 0 });

function addTo(totals: Totals, a: Activity): void {
  totals.count += 1;
  totals.distance += a.distance;
  totals.duration += a.duration;
}

/** The bars for a chart range: twelve weeks, the days of this month, or the months of this year. */
export function chartBuckets(
  activities: readonly Activity[],
  range: ChartRange,
  now: Date,
  startsOn: WeekStartDay
): ChartView {
  if (range === 'weeks') {
    const buckets = weeklyBuckets(activities, WEEKS_SHOWN, now, startsOn);
    return {
      buckets,
      currentIndex: buckets.length - 1,
      label: (i) => String(buckets[i]?.start.getDate() ?? ''),
      unit: 'week',
      span: `last ${WEEKS_SHOWN} weeks`,
    };
  }

  const year = now.getFullYear();
  if (range === 'month') {
    const month = now.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const buckets: WeekBucket[] = Array.from({ length: days }, (_, i) => ({
      start: new Date(year, month, i + 1),
      ...empty(),
    }));
    for (const a of activities) {
      const at = new Date(a.createdAt);
      const bucket =
        at.getFullYear() === year && at.getMonth() === month && buckets[at.getDate() - 1];
      if (bucket) addTo(bucket, a);
    }
    return {
      buckets,
      currentIndex: now.getDate() - 1,
      label: (i) => {
        const day = i + 1;
        return day === 1 || day % 5 === 0 ? String(day) : '';
      },
      unit: 'day',
      span: 'this month',
    };
  }

  const buckets: WeekBucket[] = Array.from({ length: 12 }, (_, i) => ({
    start: new Date(year, i, 1),
    ...empty(),
  }));
  for (const a of activities) {
    const at = new Date(a.createdAt);
    const bucket = at.getFullYear() === year && buckets[at.getMonth()];
    if (bucket) addTo(bucket, a);
  }
  return {
    buckets,
    currentIndex: now.getMonth(),
    label: (i) => MONTH_INITIALS[i] ?? '',
    unit: 'month',
    span: 'this year',
  };
}

export interface SportRow extends Totals {
  sport: ActivityType;
  /** Distance as a share of the sport with the most, for the bar. */
  share: number;
}

function rangeStart(range: ChartRange, now: Date, startsOn: WeekStartDay): Date {
  if (range === 'year') return new Date(now.getFullYear(), 0, 1);
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  const start = weekStart(now, startsOn);
  start.setDate(start.getDate() - 7 * (WEEKS_SHOWN - 1));
  return start;
}

/** What each sport added to the chart range, most distance first. */
export function sportBreakdown(
  activities: readonly Activity[],
  range: ChartRange,
  now: Date,
  startsOn: WeekStartDay
): SportRow[] {
  const from = rangeStart(range, now, startsOn).getTime();
  const rows = new Map<ActivityType, Totals>();
  for (const a of activities) {
    const at = new Date(a.createdAt).getTime();
    if (at < from || at > now.getTime()) continue;
    const row = rows.get(a.activityType) ?? empty();
    addTo(row, a);
    rows.set(a.activityType, row);
  }
  const sorted = [...rows].sort(([, a], [, b]) => b.distance - a.distance || b.count - a.count);
  const largest = sorted[0]?.[1].distance ?? 0;
  return sorted.map(([sport, totals]) => ({
    sport,
    ...totals,
    share: largest > 0 ? totals.distance / largest : 0,
  }));
}
