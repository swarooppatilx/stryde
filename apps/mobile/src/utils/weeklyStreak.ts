import type { Activity } from '@/types';
import { type WeekStartDay, weekStart } from './trainingLog';

/** Whether anything has been logged in the week that holds `now`. */
export function loggedThisWeek(
  activities: readonly Pick<Activity, 'createdAt'>[],
  now: Date,
  weekStartsOn: WeekStartDay
): boolean {
  const start = weekStart(now, weekStartsOn).getTime();
  return activities.some((a) => {
    const at = new Date(a.createdAt).getTime();
    return at >= start && at <= now.getTime();
  });
}

/**
 * Weeks in a row with at least one activity, ending at the current week. A current week with nothing yet does not break the
 * streak (it is still open), so counting then starts from the week before.
 */
export function weeklyStreak(
  activities: readonly Pick<Activity, 'createdAt'>[],
  now: Date,
  weekStartsOn: WeekStartDay
): number {
  const active = new Set<number>();
  for (const a of activities) {
    const at = new Date(a.createdAt);
    if (at.getTime() <= now.getTime()) active.add(weekStart(at, weekStartsOn).getTime());
  }

  const cursor = weekStart(now, weekStartsOn);
  if (!active.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 7);

  let weeks = 0;
  while (active.has(cursor.getTime())) {
    weeks++;
    // Step in calendar days so a daylight-saving week is still one week.
    cursor.setDate(cursor.getDate() - 7);
  }
  return weeks;
}

/** The longest run of consecutive weeks with at least one activity, anywhere in the list. */
export function weeklyStreakPeak(
  activities: readonly Pick<Activity, 'createdAt'>[],
  weekStartsOn: WeekStartDay
): number {
  const active = new Set<number>();
  for (const a of activities) {
    active.add(weekStart(new Date(a.createdAt), weekStartsOn).getTime());
  }
  let best = 0;
  for (const start of active) {
    const before = new Date(start);
    before.setDate(before.getDate() - 7);
    if (active.has(before.getTime())) continue;
    // Count forward from the first week of each run, stepping by calendar days for daylight saving.
    let length = 0;
    const cursor = new Date(start);
    while (active.has(cursor.getTime())) {
      length++;
      cursor.setDate(cursor.getDate() + 7);
    }
    best = Math.max(best, length);
  }
  return best;
}
