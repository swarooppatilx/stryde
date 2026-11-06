import type { SavedDebrief, SavedReview } from '@/stores/coachStore';
import type { Activity } from '@/types';
import type { HeartRateProfile } from '@/utils/coachRun';
import { effortSignal } from '@/utils/effortSignal';
import { type Goal, type GoalMetric, goalStanding, goalTitle } from '@/utils/goals';
import { type WeekStartDay, weeklyBuckets } from '@/utils/trainingLog';

export interface FactVolume {
  km: number;
  minutes: number;
  runs: number;
}

export type FactFeel = 'great' | 'good' | 'ok' | 'bad' | 'terrible';

export interface FactGoal {
  title: string;
  metric: GoalMetric;
  /** In km, minutes, metres or a count, as `metric` says. */
  done: number;
  target: number;
  reached: boolean;
  daysLeft: number;
}

/** The numbers the plan is held to and cites: computed on the phone from the athlete's own log. */
export interface CoachFacts {
  week: FactVolume;
  lastWeek: FactVolume;
  /** The longest single outing in the last 14 days, km. */
  longestKm14: number;
  /** Days since a hard run; null when none in the log. */
  daysSinceHard: number | null;
  /** Distinct days in the last 7 with a hard run, today included. */
  hardDays7: number;
  lastFeel: { feel: FactFeel; daysAgo: number } | null;
  goals: FactGoal[];
  /** What the latest post-run review said the next session should be. */
  nextRun: string | null;
}

export interface FactsContext {
  debriefs: Readonly<Record<string, SavedDebrief>>;
  reviews: Readonly<Record<string, SavedReview>>;
  goals: readonly Goal[];
  weekStartsOn: WeekStartDay;
  profile?: HeartRateProfile;
}

const DAY_MS = 86_400_000;
const MAX_GOALS = 5;
/** Sports whose distance counts towards the weekly load the plan is held to. */
const ON_FOOT = new Set(['run', 'walk', 'hike']);

const EMPTY_WEEK = { count: 0, distance: 0, duration: 0 };

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Whole calendar days from `at` to `now` in the athlete's own time, so a daylight-saving day is still one day. */
function daysAgo(at: Date, now: Date): number {
  const a = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((n - a) / DAY_MS);
}

function volume(totals: { count: number; distance: number; duration: number }): FactVolume {
  return {
    km: round1(totals.distance / 1000),
    minutes: Math.round(totals.duration / 60_000),
    runs: totals.count,
  };
}

function normaliseFeel(activity: Activity, debrief?: SavedDebrief): FactFeel | null {
  const said = debrief?.feel;
  if (said === 'tough') return 'bad';
  if (said) return said;
  return activity.feel ?? null;
}

function goalValue(metric: GoalMetric, raw: number): number {
  if (metric === 'distance') return round1(raw / 1000);
  if (metric === 'time') return Math.round(raw / 60_000);
  return Math.round(raw);
}

function latestNextRun(reviews: FactsContext['reviews']): string | null {
  const latest = Object.values(reviews).reduce<SavedReview | null>(
    (best, r) => (!best || r.createdAt > best.createdAt ? r : best),
    null
  );
  return latest?.review.nextRun?.trim() || null;
}

/**
 * This week against last, the longest recent outing, how recently and how often the athlete went
 * hard, how they felt last, their goals and the latest review's advice. Mocked and commute
 * activities are not training and are left out.
 */
export function coachFacts(
  activities: readonly Activity[],
  ctx: FactsContext,
  now: Date
): CoachFacts {
  const real = activities.filter((a) => !a.mocked);
  const training = real.filter((a) => !a.isCommute);
  const onFoot = training.filter((a) => ON_FOOT.has(a.activityType));

  const [last = EMPTY_WEEK, current = EMPTY_WEEK] = weeklyBuckets(onFoot, 2, now, ctx.weekStartsOn);

  const longest = onFoot
    .filter((a) => {
      const age = daysAgo(new Date(a.createdAt), now);
      return age >= 0 && age < 14;
    })
    .reduce((max, a) => Math.max(max, a.distance), 0);

  const hardAges: number[] = [];
  let latestFelt: { at: number; feel: FactFeel; age: number } | null = null;
  for (const activity of training) {
    const at = new Date(activity.createdAt);
    const age = daysAgo(at, now);
    if (age < 0) continue;
    const debrief = ctx.debriefs[activity.id];
    if (effortSignal(activity, debrief, ctx.profile) === 'hard') {
      hardAges.push(age);
    }
    const feel = normaliseFeel(activity, debrief);
    if (feel && (!latestFelt || at.getTime() > latestFelt.at)) {
      latestFelt = { at: at.getTime(), feel, age };
    }
  }

  return {
    week: volume(current),
    lastWeek: volume(last),
    longestKm14: round1(longest / 1000),
    daysSinceHard: hardAges.length ? Math.min(...hardAges) : null,
    hardDays7: new Set(hardAges.filter((age) => age < 7)).size,
    lastFeel: latestFelt ? { feel: latestFelt.feel, daysAgo: latestFelt.age } : null,
    goals: ctx.goals.slice(0, MAX_GOALS).map((goal) => {
      const standing = goalStanding(goal, real, now, ctx.weekStartsOn);
      return {
        title: goalTitle(goal),
        metric: goal.metric,
        done: goalValue(goal.metric, standing.done),
        target: goalValue(goal.metric, standing.target),
        reached: standing.reached,
        daysLeft: standing.daysLeft,
      };
    }),
    nextRun: latestNextRun(ctx.reviews),
  };
}
