/** One activity, as the club leaderboard needs it. */
export interface ClubActivity {
  athlete: string;
  /** Metres. */
  distance: number;
  /** Moving time, ms. */
  duration: number;
  /** ms since 1970. */
  at: number;
}

export type WeeklyMetric = 'distance' | 'time' | 'activities';

export interface WeeklyRow {
  athlete: string;
  distance: number;
  duration: number;
  activities: number;
  rank: number;
}

const DAY_MS = 86_400_000;

/** Midnight local time on the Monday of the week holding `at`. */
export function weekStart(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  const sinceMonday = (d.getDay() + 6) % 7;
  return d.getTime() - sinceMonday * DAY_MS;
}

/** This week's (or, with `weeksAgo`, an earlier week's) totals per member, best first by `metric`. */
export function weeklyLeaderboard(
  activities: readonly ClubActivity[],
  members: readonly string[],
  metric: WeeklyMetric,
  now: number,
  weeksAgo = 0
): WeeklyRow[] {
  const from = weekStart(now) - weeksAgo * 7 * DAY_MS;
  const to = from + 7 * DAY_MS;
  const memberSet = new Set(members.map((m) => m.toLowerCase()));
  const totals = new Map<string, Omit<WeeklyRow, 'rank'>>();
  for (const a of activities) {
    const who = a.athlete.toLowerCase();
    if (!memberSet.has(who) || a.at < from || a.at >= to) continue;
    const row = totals.get(who) ?? { athlete: who, distance: 0, duration: 0, activities: 0 };
    row.distance += a.distance;
    row.duration += a.duration;
    row.activities += 1;
    totals.set(who, row);
  }
  const value = (r: Omit<WeeklyRow, 'rank'>) => {
    if (metric === 'distance') return r.distance;
    return metric === 'time' ? r.duration : r.activities;
  };
  return [...totals.values()]
    .sort((a, b) => value(b) - value(a) || b.distance - a.distance)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/** The club's totals for the week: everyone's distance, time and activity count added up. */
export function weeklyTotals(rows: readonly WeeklyRow[]) {
  return rows.reduce(
    (sum, r) => ({
      distance: sum.distance + r.distance,
      duration: sum.duration + r.duration,
      activities: sum.activities + r.activities,
      athletes: sum.athletes + 1,
    }),
    { distance: 0, duration: 0, activities: 0, athletes: 0 }
  );
}
