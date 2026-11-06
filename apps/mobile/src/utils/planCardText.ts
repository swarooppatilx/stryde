import type { CoachPlan } from '@/services/coachService';
import type { CoachFacts } from '@/utils/coachFacts';

/** What the athlete is told about what leaves the phone. */
export const PRIVACY_LINE =
  'Runs, effort and feel go to 0G in a TEE. Never your route or private notes.';

const TYPE_LABEL: Record<NonNullable<CoachPlan['type']>, string> = {
  rest: 'Rest',
  recovery: 'Recovery',
  easy: 'Easy',
  tempo: 'Tempo',
  intervals: 'Intervals',
  long: 'Long run',
  cross: 'Cross-train',
};

const trim = (n: number) => String(Math.round(n * 10) / 10);

function hardRunText(daysSinceHard: number | null): string {
  if (daysSinceHard === null) return 'no hard run logged';
  if (daysSinceHard === 0) return 'hard run today';
  if (daysSinceHard === 1) return 'last hard run yesterday';
  return `last hard run ${daysSinceHard} days ago`;
}

/** "This week 12.4 of 20 km · last hard run 2 days ago": the numbers the plan was built from. */
export function factsLine(facts: CoachFacts | undefined | null): string | null {
  if (!facts) return null;
  const weekly = facts.goals.find((g) => g.metric === 'distance' && g.title.startsWith('Weekly'));
  const week = weekly
    ? `This week ${trim(facts.week.km)} of ${trim(weekly.target)} km`
    : `This week ${trim(facts.week.km)} km`;
  return `${week} · ${hardRunText(facts.daysSinceHard)}`;
}

/** "Easy · 5 km · 30 min"; null for a plan saved before plans were structured. */
export function planHeadline(plan: CoachPlan): string | null {
  if (!plan.type) return null;
  const parts: string[] = [TYPE_LABEL[plan.type]];
  if (plan.distanceKm) parts.push(`${trim(plan.distanceKm)} km`);
  if (plan.durationMin) parts.push(`${Math.round(plan.durationMin)} min`);
  return parts.join(' · ');
}
