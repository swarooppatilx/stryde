import type { Activity, ActivityType } from '@/types';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  METERS_PER_MILE,
  SPORT_LABEL,
  type UnitSystem,
} from '@/utils/format';
import { type WeekStartDay, weekStart } from '@/utils/trainingLog';

export type GoalMetric = 'distance' | 'time' | 'elevation' | 'activities';
export type GoalPeriod = 'week' | 'month' | 'year';

/** A target over a calendar period. Distance and elevation are in metres, time in ms. */
export interface Goal {
  id: string;
  metric: GoalMetric;
  period: GoalPeriod;
  target: number;
  /** Only this sport counts; every sport when absent. */
  sport?: ActivityType;
}

export interface GoalStanding {
  done: number;
  target: number;
  /** done / target, capped at 1 so a bar never overflows. */
  ratio: number;
  reached: boolean;
  /** Days left in the period, today included. */
  daysLeft: number;
}

export const GOAL_METRICS: readonly { value: GoalMetric; label: string }[] = [
  { value: 'distance', label: 'Distance' },
  { value: 'time', label: 'Time' },
  { value: 'elevation', label: 'Elevation' },
  { value: 'activities', label: 'Activities' },
];

export const GOAL_PERIODS: readonly { value: GoalPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

const DAY_MS = 86_400_000;

/** The calendar week, month or year holding `now`: `start` is included, `end` is not. */
export function periodRange(
  period: GoalPeriod,
  now: Date,
  weekStartsOn: WeekStartDay
): { start: Date; end: Date } {
  if (period === 'week') {
    const start = weekStart(now, weekStartsOn);
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) };
  }
  if (period === 'month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }
  return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
}

function contribution(metric: GoalMetric, activity: Activity): number {
  switch (metric) {
    case 'distance':
      return activity.distance;
    case 'time':
      return activity.duration;
    case 'elevation':
      return activity.elevationGain ?? 0;
    case 'activities':
      return 1;
  }
}

/** How far along a goal is, from the activities already done inside its period. */
export function goalStanding(
  goal: Goal,
  activities: readonly Activity[],
  now: Date,
  weekStartsOn: WeekStartDay
): GoalStanding {
  const { start, end } = periodRange(goal.period, now, weekStartsOn);
  let done = 0;
  for (const activity of activities) {
    if (goal.sport && activity.activityType !== goal.sport) continue;
    const at = new Date(activity.createdAt).getTime();
    if (at >= start.getTime() && at < end.getTime() && at <= now.getTime()) {
      done += contribution(goal.metric, activity);
    }
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    done,
    target: goal.target,
    ratio: goal.target > 0 ? Math.min(done / goal.target, 1) : 0,
    reached: goal.target > 0 && done >= goal.target,
    daysLeft: Math.max(0, Math.round((end.getTime() - today.getTime()) / DAY_MS)),
  };
}

const PERIOD_ADJECTIVE: Record<GoalPeriod, string> = {
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
};

const METRIC_NOUN: Record<GoalMetric, string> = {
  distance: 'distance',
  time: 'time',
  elevation: 'elevation',
  activities: 'activities',
};

/** "Weekly distance", or "Yearly elevation · Cycling" for one sport. */
export function goalTitle(goal: Goal): string {
  const base = `${PERIOD_ADJECTIVE[goal.period]} ${METRIC_NOUN[goal.metric]}`;
  return goal.sport ? `${base} · ${SPORT_LABEL[goal.sport] ?? goal.sport}` : base;
}

/** A goal figure as text in the athlete's units. */
export function formatGoalValue(metric: GoalMetric, value: number, units: UnitSystem): string {
  switch (metric) {
    case 'distance':
      return formatDistance(value, units);
    case 'time':
      return formatDuration(value);
    case 'elevation':
      return formatElevation(value, units);
    case 'activities':
      return String(Math.round(value));
  }
}

export interface TargetBounds {
  step: number;
  min: number;
  max: number;
  /** Where a new goal starts. */
  initial: number;
}

const FEET_IN_METERS = 0.3048;
const HOUR_MS = 3_600_000;

/** [week, month, year] multipliers of the step, minimum, maximum and starting value of a target. */
const SCALE: Record<
  GoalMetric,
  { unit: number; step: number[]; max: number[]; initial: number[] }
> = {
  distance: { unit: 1000, step: [1, 5, 50], max: [200, 800, 10_000], initial: [20, 80, 1000] },
  time: {
    unit: HOUR_MS / 4,
    step: [1, 4, 40],
    max: [160, 640, 8000],
    initial: [12, 48, 600],
  },
  elevation: {
    unit: 1,
    step: [100, 500, 5000],
    max: [5000, 20_000, 200_000],
    initial: [500, 2000, 20_000],
  },
  activities: { unit: 1, step: [1, 1, 5], max: [30, 120, 1500], initial: [3, 12, 150] },
};

const PERIOD_INDEX: Record<GoalPeriod, number> = { week: 0, month: 1, year: 2 };

/** How a target moves in the stepper: whole miles, feet or kilometres per tap, scaled to the period. */
export function targetBounds(
  metric: GoalMetric,
  period: GoalPeriod,
  units: UnitSystem
): TargetBounds {
  const scale = SCALE[metric];
  const at = PERIOD_INDEX[period];
  let unit = scale.unit;
  if (units === 'imperial' && metric === 'distance') unit = METERS_PER_MILE;
  if (units === 'imperial' && metric === 'elevation') unit = FEET_IN_METERS;
  const step = (scale.step[at] ?? 1) * unit;
  return {
    step,
    min: step,
    max: (scale.max[at] ?? 1) * unit,
    initial: (scale.initial[at] ?? 1) * unit,
  };
}

/** The three weekly goals an athlete already had, as goals; read once when the first list is made. */
export function seedGoals(weekly: {
  distance: number;
  activities: number;
  time: number;
}): Array<Omit<Goal, 'id'>> {
  return [
    { metric: 'distance', period: 'week', target: weekly.distance },
    { metric: 'activities', period: 'week', target: weekly.activities },
    { metric: 'time', period: 'week', target: weekly.time },
  ];
}

/** The weekly target for each metric across all sports, falling back to the older settings. */
export function weeklyTargets(
  goals: readonly Goal[],
  fallback: { distance: number; activities: number; time: number }
): { distance: number; activities: number; time: number } {
  const find = (metric: GoalMetric, other: number) =>
    goals.find((g) => g.period === 'week' && g.metric === metric && !g.sport)?.target ?? other;
  return {
    distance: find('distance', fallback.distance),
    activities: find('activities', fallback.activities),
    time: find('time', fallback.time),
  };
}
