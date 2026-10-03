import type { Activity, ActivityType } from '@/types';

export interface PeriodStats {
  count: number;
  /** Meters. */
  distance: number;
  /** Moving time in ms. */
  duration: number;
  /** Meters climbed; activities with no elevation count as zero. */
  elevation: number;
  activeDays: number;
  /** Meters per week over the period (all time: since the first activity). */
  distancePerWeek: number;
  /** Moving time in ms per week over the same stretch. */
  durationPerWeek: number;
  /** Meters climbed per week over the same stretch. */
  elevationPerWeek: number;
  /** Activities per week over the same stretch. */
  activitiesPerWeek: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const RECENT_WEEKS = 4;

function summarise(activities: readonly Activity[], weeks: number): PeriodStats {
  const days = new Set<string>();
  let distance = 0;
  let duration = 0;
  let elevation = 0;
  for (const a of activities) {
    distance += a.distance;
    duration += a.duration;
    elevation += a.elevationGain ?? 0;
    const when = new Date(a.createdAt);
    days.add(`${when.getFullYear()}-${when.getMonth()}-${when.getDate()}`);
  }
  const perWeek = (total: number) => (activities.length > 0 && weeks > 0 ? total / weeks : 0);
  return {
    count: activities.length,
    distance,
    duration,
    elevation,
    activeDays: days.size,
    distancePerWeek: perWeek(distance),
    durationPerWeek: perWeek(duration),
    elevationPerWeek: perWeek(elevation),
    activitiesPerWeek: perWeek(activities.length),
  };
}

/** Totals for the last four weeks, this calendar year and everything so far (nothing in the future). */
export function periodStats(
  activities: readonly Activity[],
  now: Date
): { recent: PeriodStats; thisMonth: PeriodStats; thisYear: PeriodStats; allTime: PeriodStats } {
  const past = activities.filter((a) => new Date(a.createdAt).getTime() <= now.getTime());
  const recentStart = now.getTime() - RECENT_WEEKS * WEEK_MS;
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const first = Math.min(...past.map((a) => new Date(a.createdAt).getTime()));
  // At least one week, so a first activity this week is not divided by almost nothing.
  const allTimeWeeks = past.length > 0 ? Math.max(1, (now.getTime() - first) / WEEK_MS) : 0;
  const yearWeeks = Math.max(1, (now.getTime() - yearStart) / WEEK_MS);

  return {
    recent: summarise(
      past.filter((a) => new Date(a.createdAt).getTime() >= recentStart),
      RECENT_WEEKS
    ),
    thisMonth: summarise(
      past.filter((a) => new Date(a.createdAt).getTime() >= monthStart),
      Math.max(1, (now.getTime() - monthStart) / WEEK_MS)
    ),
    thisYear: summarise(
      past.filter((a) => new Date(a.createdAt).getTime() >= yearStart),
      yearWeeks
    ),
    allTime: summarise(past, allTimeWeeks),
  };
}

/** The sports with at least one activity, most done first. */
export function sportsDone(activities: readonly Activity[]): ActivityType[] {
  const counts = new Map<ActivityType, number>();
  for (const a of activities) counts.set(a.activityType, (counts.get(a.activityType) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([type]) => type);
}

export interface SportTotals {
  sport: ActivityType;
  count: number;
  /** Meters. */
  distance: number;
  /** Moving time in ms. */
  duration: number;
}

/** Totals for each sport done, the one with the most distance first (ties by number of activities). */
export function sportBreakdown(activities: readonly Activity[]): SportTotals[] {
  const totals = new Map<ActivityType, SportTotals>();
  for (const a of activities) {
    const row = totals.get(a.activityType) ?? {
      sport: a.activityType,
      count: 0,
      distance: 0,
      duration: 0,
    };
    row.count += 1;
    row.distance += a.distance;
    row.duration += a.duration;
    totals.set(a.activityType, row);
  }
  return [...totals.values()].sort((a, b) => b.distance - a.distance || b.count - a.count);
}
