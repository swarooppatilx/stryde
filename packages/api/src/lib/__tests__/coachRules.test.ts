import { describe, expect, it } from 'vitest';
import type { DailyPlan } from '../coach.js';
import type { CoachFacts } from '../coachFacts.js';
import { checkPlan, singleRunLimitKm, weeklyLimitKm } from '../coachRules.js';

const facts = (over: Partial<CoachFacts> = {}): CoachFacts => ({
  week: { km: 8, minutes: 50, runs: 2 },
  lastWeek: { km: 20, minutes: 130, runs: 4 },
  longestKm14: 10,
  daysSinceHard: 5,
  hardDays7: 1,
  lastFeel: null,
  goals: [],
  nextRun: null,
  ...over,
});

const plan = (over: Partial<DailyPlan> = {}): DailyPlan => ({
  title: 'Steady run',
  type: 'easy',
  distanceKm: 6,
  durationMin: 40,
  effort: 'easy',
  summary: 'Easy does it.',
  steps: [{ label: 'Run', detail: '6 km easy' }],
  why: 'Last week was 20 km.',
  ...over,
});

describe('limits', () => {
  it('lets the week grow by 10%, by 3 km, or to 10 km, whichever is most', () => {
    expect(weeklyLimitKm(facts({ lastWeek: { km: 50, minutes: 0, runs: 5 } }))).toBeCloseTo(55);
    expect(weeklyLimitKm(facts({ lastWeek: { km: 20, minutes: 0, runs: 5 } }))).toBeCloseTo(23);
    expect(weeklyLimitKm(facts({ lastWeek: { km: 2, minutes: 0, runs: 1 } }))).toBe(10);
    expect(weeklyLimitKm(facts({ lastWeek: { km: 0, minutes: 0, runs: 0 } }))).toBe(10);
  });

  it('lets one outing beat the longest recent one by a quarter, or reach 5 km', () => {
    expect(singleRunLimitKm(facts({ longestKm14: 20 }))).toBe(25);
    expect(singleRunLimitKm(facts({ longestKm14: 2 }))).toBe(5);
    expect(singleRunLimitKm(facts({ longestKm14: 0 }))).toBe(5);
    expect(singleRunLimitKm(facts({ longestKm14: null }))).toBeNull();
  });
});

describe('checkPlan: weekly distance', () => {
  it('passes a plan that stays inside the cap', () => {
    // limit 23, 8 done: room 15
    const result = checkPlan(plan({ distanceKm: 9 }), facts({ longestKm14: 12 }));
    expect(result.violations).toEqual([]);
    expect(result.adjusted).toEqual([]);
    expect(result.clamped).toEqual(plan({ distanceKm: 9 }));
  });

  it('flags and clamps a plan that breaks the cap', () => {
    // limit 23, 20 done: room 3
    const p = plan({ distanceKm: 8, durationMin: 48 });
    const result = checkPlan(p, facts({ week: { km: 20, minutes: 130, runs: 4 } }));
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('at most 3 km');
    expect(result.clamped.distanceKm).toBe(3);
    expect(result.clamped.durationMin).toBe(18);
    expect(result.adjusted[0]).toMatch(/Shortened/);
    // The model's text no longer matches its numbers, so it is replaced.
    expect(result.clamped.steps[0]?.detail).toContain('3 km');
  });

  it('uses the 10 km floor for a new runner', () => {
    const f = facts({
      lastWeek: { km: 0, minutes: 0, runs: 0 },
      week: { km: 0, minutes: 0, runs: 0 },
      longestKm14: 0,
    });
    expect(checkPlan(plan({ distanceKm: 5 }), f).violations).toEqual([]);
    // single-run floor of 5 km binds first
    const big = checkPlan(plan({ distanceKm: 9 }), f);
    expect(big.clamped.distanceKm).toBe(5);
  });

  it('turns the day into rest when the week has no room left', () => {
    const result = checkPlan(
      plan({ distanceKm: 5 }),
      facts({ week: { km: 22.5, minutes: 150, runs: 5 } })
    );
    expect(result.clamped).toMatchObject({
      type: 'rest',
      distanceKm: null,
      durationMin: null,
      effort: 'rest',
    });
    expect(result.adjusted).toHaveLength(1);
  });

  it('never raises a distance, even when the limits are generous', () => {
    const p = plan({ distanceKm: 2 });
    const result = checkPlan(
      p,
      facts({ lastWeek: { km: 80, minutes: 0, runs: 8 }, longestKm14: 30 })
    );
    expect(result.clamped).toBe(p);
  });
});

describe('checkPlan: single outing', () => {
  it('clamps an outing beyond a quarter over the longest recent one', () => {
    // longest 10 -> limit 12.5; weekly room is ample (week 0, limit 23)
    const result = checkPlan(
      plan({ type: 'long', effort: 'moderate', distanceKm: 16, durationMin: 120 }),
      facts({ week: { km: 0, minutes: 0, runs: 0 } })
    );
    expect(result.violations.some((v) => v.includes('longest recent outing'))).toBe(true);
    expect(result.clamped.distanceKm).toBe(12.5);
    expect(result.clamped.durationMin).toBe(94);
  });

  it('skips the rule when the longest outing is unknown', () => {
    const result = checkPlan(
      plan({ distanceKm: 15 }),
      facts({ week: { km: 0, minutes: 0, runs: 0 }, longestKm14: null })
    );
    expect(result.violations).toEqual([]);
  });

  it('allows up to 5 km after a short recent history', () => {
    const f = facts({ longestKm14: 3, week: { km: 0, minutes: 0, runs: 0 } });
    expect(checkPlan(plan({ distanceKm: 5 }), f).violations).toEqual([]);
    expect(checkPlan(plan({ distanceKm: 5.5 }), f).clamped.distanceKm).toBe(5);
  });
});

describe('checkPlan: hard after hard', () => {
  const hard = plan({ type: 'intervals', effort: 'hard', distanceKm: 5, title: 'Intervals' });

  it('makes a hard session easy the day after a hard one', () => {
    const result = checkPlan(hard, facts({ daysSinceHard: 1 }));
    expect(result.violations[0]).toContain('yesterday');
    expect(result.clamped).toMatchObject({ type: 'easy', effort: 'easy', title: 'Easy run' });
  });

  it('also applies the same day', () => {
    expect(checkPlan(hard, facts({ daysSinceHard: 0 })).violations[0]).toContain('today');
  });

  it('allows a hard session two days after a hard one', () => {
    expect(checkPlan(hard, facts({ daysSinceHard: 2 })).violations).toEqual([]);
  });

  it('blocks a third hard day in a week', () => {
    const result = checkPlan(plan({ type: 'tempo', effort: 'moderate' }), facts({ hardDays7: 3 }));
    expect(result.clamped.type).toBe('easy');
    expect(checkPlan(hard, facts({ hardDays7: 2 })).violations).toEqual([]);
  });

  it('turns a long or hard-effort run into recovery after a bad day', () => {
    const bad = facts({ lastFeel: { feel: 'terrible', daysAgo: 1 } });
    expect(checkPlan(plan({ type: 'long', distanceKm: 8 }), bad).clamped.type).toBe('recovery');
    expect(checkPlan(plan({ type: 'easy', effort: 'hard' }), bad).clamped.type).toBe('recovery');
  });

  it('ignores a bad feel from days ago, and never touches an easy plan', () => {
    expect(checkPlan(hard, facts({ lastFeel: { feel: 'bad', daysAgo: 3 } })).violations).toEqual(
      []
    );
    expect(
      checkPlan(plan(), facts({ daysSinceHard: 0, lastFeel: { feel: 'bad', daysAgo: 0 } }))
        .violations
    ).toEqual([]);
  });

  it('keeps the distance while lowering the intensity', () => {
    expect(checkPlan(hard, facts({ daysSinceHard: 1 })).clamped.distanceKm).toBe(5);
  });
});

describe('checkPlan: nothing to check', () => {
  it('passes everything when there are no facts', () => {
    const p = plan({ distanceKm: 50, type: 'long', effort: 'hard' });
    expect(checkPlan(p, null)).toEqual({ violations: [], clamped: p, adjusted: [] });
  });

  it('passes a rest day', () => {
    const p = plan({ type: 'rest', effort: 'rest', distanceKm: null, durationMin: null });
    expect(checkPlan(p, facts({ daysSinceHard: 0 })).violations).toEqual([]);
  });

  it('passes a plan without a distance through the distance rules', () => {
    const p = plan({ distanceKm: null });
    expect(checkPlan(p, facts({ week: { km: 99, minutes: 0, runs: 9 } })).violations).toEqual([]);
  });
});

describe('checkPlan: clamp only lowers', () => {
  it('never exceeds the original distance, duration or intensity over many shapes', () => {
    const order = {
      rest: 0,
      recovery: 1,
      easy: 2,
      moderate: 3,
      tempo: 4,
      long: 4,
      intervals: 4,
      cross: 2,
      hard: 4,
    };
    for (const week of [0, 8, 20, 30]) {
      for (const km of [1, 3, 6, 12, 30]) {
        for (const type of ['easy', 'tempo', 'long', 'intervals'] as const) {
          for (const daysSinceHard of [null, 0, 1, 4]) {
            const p = plan({ type, distanceKm: km, durationMin: km * 7, effort: 'moderate' });
            const result = checkPlan(
              p,
              facts({ week: { km: week, minutes: 0, runs: 1 }, daysSinceHard })
            );
            const c = result.clamped;
            expect(c.distanceKm ?? 0).toBeLessThanOrEqual(p.distanceKm ?? 0);
            expect(c.durationMin ?? 0).toBeLessThanOrEqual(p.durationMin ?? 0);
            expect(order[c.type]).toBeLessThanOrEqual(order[p.type]);
          }
        }
      }
    }
  });
});
