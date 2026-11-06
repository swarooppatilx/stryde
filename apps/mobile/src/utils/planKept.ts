import type { CoachPlan } from '@/services/coachService';
import type { SavedPlan } from '@/stores/coachStore';
import type { Activity } from '@/types';
import { parseCalendarDay, toCalendarDay } from '@/utils/dates';

/** A run counts toward the plan once it reaches this share of the planned distance or time. */
export const PLAN_DONE_SHARE = 0.8;
/** Floating-point slack: 6 km x 0.8 is 4.800000000000001, and 4.8 km must still count. */
const EPSILON = 1e-9;
/** A run that ended up to an hour before the commitment still counts: people commit late. */
export const COMMIT_GRACE_MS = 60 * 60 * 1000;

/**
 * The first run on the plan's day, at or after the athlete committed, that is long enough. A rest
 * day has no run to match: it is kept by committing to it. A plan with no target takes any run.
 */
export function findPlanRun(
  plan: CoachPlan,
  day: string,
  committedAt: number,
  activities: readonly Activity[]
): Activity | null {
  if (plan.type === 'rest') return null;
  const wantKm = plan.distanceKm ?? 0;
  const wantMin = plan.durationMin ?? 0;
  const matches = activities.filter((a) => {
    if (a.mocked || a.isCommute) return false;
    // createdAt is when the run was saved, so its end. Distance is in metres, duration in ms.
    const ended = new Date(a.createdAt);
    if (Number.isNaN(ended.getTime()) || toCalendarDay(ended) !== day) return false;
    if (ended.getTime() < committedAt - COMMIT_GRACE_MS) return false;
    const km = a.distance / 1000;
    const min = a.duration / 60_000;
    if (!wantKm && !wantMin) return km > 0;
    return (
      (wantKm > 0 && km >= wantKm * PLAN_DONE_SHARE - EPSILON) ||
      (wantMin > 0 && min >= wantMin * PLAN_DONE_SHARE - EPSILON)
    );
  });
  matches.sort((x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime());
  return matches[0] ?? null;
}

/** Whether a saved plan was kept: its run was done, or it is a rest day the athlete committed to. */
export function isKept(saved: SavedPlan): boolean {
  if (saved.doneRunId) return true;
  return saved.plan.type === 'rest' && saved.committedAt !== undefined;
}

/** The days on which a plan was kept. */
export function keptDays(plans: Readonly<Record<string, SavedPlan>>): string[] {
  return Object.values(plans)
    .filter(isKept)
    .map((p) => p.day)
    .sort();
}

/** Days in a row, ending today or yesterday, on which a committed plan was kept. */
export function planStreak(doneDays: readonly string[], today: string): number {
  const done = new Set(doneDays);
  const cursor = parseCalendarDay(today);
  // Today not done yet does not break the streak until the day is over.
  if (!done.has(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (done.has(toCalendarDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Committed plans whose run has since been saved, so the coach screen can mark them kept. Runs that
 * sync late still find their plan, because every unfinished committed plan is checked, not only today's.
 */
export function planUpdates(
  plans: Readonly<Record<string, SavedPlan>>,
  activities: readonly Activity[]
): { day: string; runId: string }[] {
  const updates: { day: string; runId: string }[] = [];
  for (const saved of Object.values(plans)) {
    if (saved.committedAt === undefined || saved.doneRunId) continue;
    const run = findPlanRun(saved.plan, saved.day, saved.committedAt, activities);
    if (run) updates.push({ day: saved.day, runId: run.id });
  }
  return updates;
}
