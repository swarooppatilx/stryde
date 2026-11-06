import { describe, expect, it } from 'vitest';
import type { CoachPlan } from '@/services/coachService';
import type { CoachFacts } from '@/utils/coachFacts';
import { factsLine, PRIVACY_LINE, planHeadline } from '@/utils/planCardText';

const facts = (over: Partial<CoachFacts> = {}): CoachFacts => ({
  week: { km: 12.4, minutes: 80, runs: 3 },
  lastWeek: { km: 20, minutes: 130, runs: 4 },
  longestKm14: 9,
  daysSinceHard: 2,
  hardDays7: 1,
  lastFeel: null,
  goals: [],
  nextRun: null,
  ...over,
});

const goal = (over = {}) => ({
  title: 'Weekly distance',
  metric: 'distance' as const,
  done: 12.4,
  target: 20,
  reached: false,
  daysLeft: 3,
  ...over,
});

describe('factsLine', () => {
  it('shows the week against the weekly distance goal', () => {
    expect(factsLine(facts({ goals: [goal()] }))).toBe(
      'This week 12.4 of 20 km · last hard run 2 days ago'
    );
  });

  it('shows just the week without a weekly distance goal', () => {
    const plain = 'This week 12.4 km · last hard run 2 days ago';
    expect(factsLine(facts())).toBe(plain);
    expect(factsLine(facts({ goals: [goal({ title: 'Monthly distance' })] }))).toBe(plain);
    expect(factsLine(facts({ goals: [goal({ metric: 'time' })] }))).toBe(plain);
  });

  it('words the hard run for today, yesterday and none', () => {
    expect(factsLine(facts({ daysSinceHard: 0 }))).toContain('hard run today');
    expect(factsLine(facts({ daysSinceHard: 1 }))).toContain('last hard run yesterday');
    expect(factsLine(facts({ daysSinceHard: null }))).toContain('no hard run logged');
  });

  it('is null without facts, as for plans saved earlier', () => {
    expect(factsLine(undefined)).toBeNull();
    expect(factsLine(null)).toBeNull();
  });

  it('rounds long decimals', () => {
    expect(factsLine(facts({ week: { km: 12.3456, minutes: 0, runs: 1 } }))).toContain('12.3 km');
  });
});

describe('planHeadline', () => {
  const base = { title: 't', summary: '', steps: [], why: '' };

  it('joins type, distance and duration', () => {
    expect(
      planHeadline({ ...base, type: 'easy', distanceKm: 5, durationMin: 30, effort: 'easy' })
    ).toBe('Easy · 5 km · 30 min');
  });

  it('leaves out figures that are null', () => {
    expect(
      planHeadline({ ...base, type: 'rest', distanceKm: null, durationMin: null, effort: 'rest' })
    ).toBe('Rest');
  });

  it('is null for a plan saved before plans were structured', () => {
    expect(planHeadline(base as CoachPlan)).toBeNull();
  });
});

describe('PRIVACY_LINE', () => {
  it('says what leaves the phone and what never does', () => {
    expect(PRIVACY_LINE).toContain('TEE');
    expect(PRIVACY_LINE).toContain('Never your route or private notes');
  });
});
