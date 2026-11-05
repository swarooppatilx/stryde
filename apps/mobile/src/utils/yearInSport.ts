import type { Activity, ActivityType } from '@/types';
import { type SportTotals, sportBreakdown } from './periodStats';
import type { WeekStartDay } from './trainingLog';
import { weeklyStreakPeak } from './weeklyStreak';

export interface YearInSport {
  year: number;
  count: number;
  /** Meters. */
  distance: number;
  /** Moving time in ms. */
  duration: number;
  /** Meters climbed. */
  elevation: number;
  activeDays: number;
  /** Zero-based month with the most distance; null with no activities. */
  topMonth: number | null;
  /** 0 = Sunday, as `Date.getDay()`; the day of the week with the most activities. */
  topWeekday: number | null;
  longest: { id: string; sport: ActivityType; distance: number } | null;
  sports: SportTotals[];
  /** Most weeks in a row with something logged during the year. */
  bestWeeklyStreak: number;
}

/** What the athlete did in one calendar year; nothing dated after `now` counts. */
export function yearInSport(
  activities: readonly Activity[],
  year: number,
  now: Date,
  weekStartsOn: WeekStartDay
): YearInSport {
  const inYear = activities.filter((a) => {
    const at = new Date(a.createdAt);
    return at.getFullYear() === year && at.getTime() <= now.getTime();
  });

  const days = new Set<string>();
  const monthDistance = new Array<number>(12).fill(0);
  const weekdayCount = new Array<number>(7).fill(0);
  let distance = 0;
  let duration = 0;
  let elevation = 0;
  let longest: Activity | null = null;
  for (const a of inYear) {
    const at = new Date(a.createdAt);
    distance += a.distance;
    duration += a.duration;
    elevation += a.elevationGain ?? 0;
    days.add(`${at.getMonth()}-${at.getDate()}`);
    monthDistance[at.getMonth()] = (monthDistance[at.getMonth()] ?? 0) + a.distance;
    weekdayCount[at.getDay()] = (weekdayCount[at.getDay()] ?? 0) + 1;
    if (!longest || a.distance > longest.distance) longest = a;
  }

  const peak = (values: number[]): number | null => {
    const max = Math.max(...values);
    return max > 0 ? values.indexOf(max) : null;
  };

  return {
    year,
    count: inYear.length,
    distance,
    duration,
    elevation,
    activeDays: days.size,
    topMonth: peak(monthDistance),
    topWeekday: peak(weekdayCount),
    longest: longest
      ? { id: longest.id, sport: longest.activityType, distance: longest.distance }
      : null,
    sports: sportBreakdown(inYear),
    bestWeeklyStreak: weeklyStreakPeak(inYear, weekStartsOn),
  };
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const monthName = (month: number): string => MONTHS[month] ?? '';
export const weekdayName = (day: number): string => WEEKDAYS[day] ?? '';

/** A short line to post: only what the athlete did, nothing about where or how it is stored. */
export function yearShareMessage(year: YearInSport, distanceText: string): string {
  if (year.count === 0) return `My ${year.year} on Stryde starts here.`;
  const outings = year.count === 1 ? '1 activity' : `${year.count} activities`;
  return `My ${year.year} on Stryde: ${distanceText} across ${outings} on ${year.activeDays} ${
    year.activeDays === 1 ? 'day' : 'days'
  }.`;
}
