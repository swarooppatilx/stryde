import type { DailyPlan, PlanType } from './coach.js';
import type { CoachFacts } from './coachFacts.js';

/** Weekly distance may grow by 10%, by 3 km, or reach 10 km, whichever allows most. */
export const WEEKLY_GROWTH = 1.1;
export const WEEKLY_STEP_KM = 3;
export const WEEKLY_FLOOR_KM = 10;
/** One outing may beat the longest of the last 14 days by a quarter, or reach 5 km. */
export const SINGLE_GROWTH = 1.25;
export const SINGLE_FLOOR_KM = 5;
/** Below this there is no session worth doing; the day becomes rest. */
const MIN_USEFUL_KM = 1;
const HARD_DAYS_LIMIT = 3;

const HARD_TYPES: readonly PlanType[] = ['tempo', 'intervals', 'long'];
const SAFE_LIMIT_NOTE = 'Rest today: this week is already at its safe limit.';

export interface PlanCheck {
  /** What the plan breaks, worded so the model can fix it on a second try. */
  violations: string[];
  /** The plan with every breach lowered to the limit; the plan itself when nothing is breached. */
  clamped: DailyPlan;
  /** Short, athlete-facing notes on what was changed; empty when nothing was. */
  adjusted: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function weeklyLimitKm(facts: CoachFacts): number {
  return Math.max(
    facts.lastWeek.km * WEEKLY_GROWTH,
    facts.lastWeek.km + WEEKLY_STEP_KM,
    WEEKLY_FLOOR_KM
  );
}

export function singleRunLimitKm(facts: CoachFacts): number | null {
  return facts.longestKm14 === null
    ? null
    : Math.max(facts.longestKm14 * SINGLE_GROWTH, SINGLE_FLOOR_KM);
}

function isHardPlan(plan: DailyPlan): boolean {
  return HARD_TYPES.includes(plan.type) || plan.effort === 'hard';
}

function feltBad(facts: CoachFacts): boolean {
  const felt = facts.lastFeel;
  return !!felt && felt.daysAgo <= 1 && (felt.feel === 'bad' || felt.feel === 'terrible');
}

/** Why a hard session is unwise today, or null. */
function needsEasyDay(facts: CoachFacts): string | null {
  if (facts.daysSinceHard !== null && facts.daysSinceHard <= 1) {
    return facts.daysSinceHard === 0
      ? 'a hard session was done today'
      : 'a hard session was done yesterday';
  }
  if (facts.hardDays7 >= HARD_DAYS_LIMIT) return `${facts.hardDays7} hard days in the last 7`;
  if (feltBad(facts)) return `the last run felt ${facts.lastFeel?.feel}`;
  return null;
}

const TITLES: Partial<Record<PlanType, string>> = {
  rest: 'Rest day',
  recovery: 'Recovery run',
  easy: 'Easy run',
};

/** A plan rebuilt from the limits alone: the model's text no longer matches its numbers. */
function rebuild(plan: DailyPlan, patch: Partial<DailyPlan>, notes: string[]): DailyPlan {
  const next = { ...plan, ...patch };
  const km = next.distanceKm;
  const detail = `${km ? `${km} km` : `${next.durationMin ?? 20} min`} at a relaxed, conversational effort`;
  return {
    ...next,
    title: TITLES[next.type] ?? next.title,
    summary: notes.join(' '),
    steps:
      next.type === 'rest'
        ? [{ label: 'Rest', detail: 'No running today. Walk, stretch, sleep well.' }]
        : [{ label: next.type === 'recovery' ? 'Recovery run' : 'Easy run', detail }],
    why: notes.join(' '),
  };
}

/**
 * Holds a plan to the athlete's own numbers: no jump in weekly distance, no outing far beyond
 * their longest recent one, no hard session straight after a hard or bad day. Clamping only ever
 * lowers distance, duration or intensity.
 */
export function checkPlan(plan: DailyPlan, facts: CoachFacts | null): PlanCheck {
  const none: PlanCheck = { violations: [], clamped: plan, adjusted: [] };
  if (!facts || plan.type === 'rest') return none;

  const violations: string[] = [];
  const adjusted: string[] = [];
  let type = plan.type;
  let effort = plan.effort;
  let distance = plan.distanceKm;
  let duration = plan.durationMin;

  const tired = needsEasyDay(facts);
  if (isHardPlan(plan) && tired) {
    violations.push(`it is a hard session but ${tired}; plan an easy or recovery session`);
    type = feltBad(facts) ? 'recovery' : 'easy';
    effort = 'easy';
    adjusted.push(`Made easy: ${tired}.`);
  }

  if (distance !== null) {
    const limit = weeklyLimitKm(facts);
    const room = Math.max(0, limit - facts.week.km);
    const single = singleRunLimitKm(facts);
    const original = distance;
    if (distance > room) {
      violations.push(
        `${distance} km would take the week to ${round1(facts.week.km + distance)} km, over the ${round1(limit)} km limit (last week ${facts.lastWeek.km} km, ${facts.week.km} km done so far); at most ${round1(room)} km today`
      );
      distance = Math.min(distance, room);
      adjusted.push('Shortened to keep this week within safe growth of last week.');
    }
    if (single !== null && distance > single) {
      violations.push(
        `${distance} km is far beyond your longest recent outing of ${facts.longestKm14} km; at most ${round1(single)} km`
      );
      distance = Math.min(distance, single);
      if (!adjusted.some((a) => a.startsWith('Shortened'))) {
        adjusted.push('Shortened: more than a quarter beyond your longest recent run.');
      }
    }
    if (distance < original) {
      if (duration !== null) duration = Math.max(5, Math.round(duration * (distance / original)));
      distance = Math.floor(distance * 10) / 10;
    }
  }

  if (violations.length === 0) return none;

  if (distance !== null && distance < MIN_USEFUL_KM) {
    return {
      violations,
      adjusted: [SAFE_LIMIT_NOTE],
      clamped: rebuild(
        plan,
        { type: 'rest', distanceKm: null, durationMin: null, effort: 'rest' },
        [SAFE_LIMIT_NOTE]
      ),
    };
  }
  return {
    violations,
    adjusted,
    clamped: rebuild(plan, { type, effort, distanceKm: distance, durationMin: duration }, adjusted),
  };
}
