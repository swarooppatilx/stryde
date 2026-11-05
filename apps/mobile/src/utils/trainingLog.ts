import type { Activity } from '@/types';

export interface Totals {
  count: number;
  distance: number; // meters
  duration: number; // ms
}

export interface WeekBucket extends Totals {
  /** Midnight on the day that starts the week, in the athlete's own time. */
  start: Date;
}

export interface CalendarDay extends Totals {
  day: number;
}

const WEEK_MS = 7 * 86_400_000;

/** The activities of one sport, or all of them for 'all'. */
export function filterBySport(activities: readonly Activity[], sport: string): readonly Activity[] {
  return sport === 'all' ? activities : activities.filter((a) => a.activityType === sport);
}

const emptyTotals = (): Totals => ({ count: 0, distance: 0, duration: 0 });

function add(totals: Totals, activity: Activity): void {
  totals.count += 1;
  totals.distance += activity.distance;
  totals.duration += activity.duration;
}

/** The weekday a week begins on: 0 is Sunday, 1 is Monday. */
export type WeekStartDay = 0 | 1;

/** How many days `date` is past the start of its week. */
const daysIntoWeek = (date: Date, startsOn: WeekStartDay) => (date.getDay() - startsOn + 7) % 7;

/** Midnight on the first day of the week that holds `date` (Sunday unless `startsOn` says Monday). */
export function weekStart(date: Date, startsOn: WeekStartDay = 0): Date {
  const start = new Date(date);
  start.setDate(date.getDate() - daysIntoWeek(date, startsOn));
  start.setHours(0, 0, 0, 0);
  return start;
}

/** The last `weeks` weeks (oldest first, ending with the current one), each with its totals. */
export function weeklyBuckets(
  activities: readonly Activity[],
  weeks: number,
  now: Date,
  startsOn: WeekStartDay = 0
): WeekBucket[] {
  const current = weekStart(now, startsOn);
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(current);
    start.setDate(current.getDate() - 7 * (weeks - 1 - i));
    return { start, ...emptyTotals() };
  });
  const first = buckets[0]?.start.getTime() ?? 0;

  for (const activity of activities) {
    const at = new Date(activity.createdAt);
    // Whole weeks since the window opened, counted in calendar days so a daylight-saving week is still one week.
    const days = Math.floor((weekStart(at, startsOn).getTime() - first) / 86_400_000 + 0.5);
    const index = Math.floor(days / 7);
    const bucket = buckets[index];
    if (bucket && at.getTime() >= first && at.getTime() < current.getTime() + WEEK_MS)
      add(bucket, activity);
  }
  return buckets;
}

/**
 * One month as rows of seven cells, the first column being the week's start day: `null` pads the days before the 1st and after the
 * last, and each real day carries what was done on it. `month` is 0-based.
 */
export function monthCalendar(
  activities: readonly Activity[],
  year: number,
  month: number,
  startsOn: WeekStartDay = 0
): { weeks: Array<Array<CalendarDay | null>> } {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: CalendarDay[] = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    ...emptyTotals(),
  }));

  for (const activity of activities) {
    const at = new Date(activity.createdAt);
    if (at.getFullYear() !== year || at.getMonth() !== month) continue;
    const cell = days[at.getDate() - 1];
    if (cell) add(cell, activity);
  }

  const cells: Array<CalendarDay | null> = [
    ...Array<null>(daysIntoWeek(new Date(year, month, 1), startsOn)).fill(null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: Array<Array<CalendarDay | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks };
}

/** What the athlete has done so far this calendar month and this calendar year. */
export function periodTotals(
  activities: readonly Activity[],
  now: Date
): { month: Totals; year: Totals } {
  const month = emptyTotals();
  const year = emptyTotals();
  for (const activity of activities) {
    const at = new Date(activity.createdAt);
    if (at.getFullYear() !== now.getFullYear()) continue;
    add(year, activity);
    if (at.getMonth() === now.getMonth()) add(month, activity);
  }
  return { month, year };
}

/** The week with the most distance across all the activities, or null with none. */
export function bestWeek(
  activities: readonly Activity[],
  startsOn: WeekStartDay = 0
): WeekBucket | null {
  const weeks = new Map<number, WeekBucket>();
  for (const activity of activities) {
    const start = weekStart(new Date(activity.createdAt), startsOn);
    const key = start.getTime();
    const week = weeks.get(key) ?? { start, ...emptyTotals() };
    add(week, activity);
    weeks.set(key, week);
  }
  let best: WeekBucket | null = null;
  for (const week of weeks.values()) {
    if (
      !best ||
      week.distance > best.distance ||
      (week.distance === best.distance && week.start < best.start)
    ) {
      best = week;
    }
  }
  return best;
}

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** One-letter weekday labels in column order, beginning with the week's start day. */
export function weekdayLabels(startsOn: WeekStartDay = 0): string[] {
  return DAY_INITIALS.map((_, i) => DAY_INITIALS[(i + startsOn) % 7] as string);
}

/** The choices offered for the first day of the week. */
export const WEEK_START_OPTIONS: Array<{ value: WeekStartDay; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
];
