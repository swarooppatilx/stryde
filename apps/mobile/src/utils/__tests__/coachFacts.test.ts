import { describe, expect, it } from 'vitest';
import type { SavedDebrief, SavedReview } from '@/stores/coachStore';
import type { Activity } from '@/types';
import { type CoachFacts, coachFacts, type FactsContext } from '@/utils/coachFacts';
import type { Goal } from '@/utils/goals';

// Friday 2026-11-06, midday local time.
const NOW = new Date(2026, 10, 6, 12, 0, 0);

/** A run `daysAgo` days before NOW, at 07:00 local. */
function run(id: string, daysAgo: number, km: number, extra: Partial<Activity> = {}): Activity {
  const at = new Date(2026, 10, 6 - daysAgo, 7, 0, 0);
  return {
    id,
    userId: 'u',
    activityType: 'run',
    distance: km * 1000,
    duration: km * 6 * 60_000,
    polyline: '',
    territory: null,
    territoryArea: 0,
    createdAt: at,
    ...extra,
  } as Activity;
}

const ctx = (over: Partial<FactsContext> = {}): FactsContext => ({
  debriefs: {},
  reviews: {},
  goals: [],
  weekStartsOn: 1,
  ...over,
});

const facts = (acts: Activity[], over: Partial<FactsContext> = {}): CoachFacts =>
  coachFacts(acts, ctx(over), NOW);

const debrief = (over: Partial<SavedDebrief>): SavedDebrief => ({
  summary: '',
  effort: null,
  feel: null,
  tags: [],
  transcript: '',
  receipts: [],
  createdAt: 0,
  ...over,
});

describe('coachFacts: empty history', () => {
  it('is all zeros and nulls with no activities', () => {
    expect(facts([])).toEqual({
      week: { km: 0, minutes: 0, runs: 0 },
      lastWeek: { km: 0, minutes: 0, runs: 0 },
      longestKm14: 0,
      daysSinceHard: null,
      hardDays7: 0,
      lastFeel: null,
      goals: [],
      nextRun: null,
    });
  });
});

describe('coachFacts: weeks', () => {
  // Monday-start: this week began Mon 2026-11-02; last week Mon 2026-10-26.
  const acts = [
    run('mon', 4, 5), // Mon 11-02, this week
    run('thu', 1, 7), // Thu 11-05, this week
    run('sun', 5, 10), // Sun 11-01, last week
    run('sat', 6, 4), // Sat 10-31, last week
    run('old', 20, 9), // outside both
  ];

  it('splits this week from last with a Monday start', () => {
    const f = facts(acts);
    expect(f.week).toEqual({ km: 12, minutes: 72, runs: 2 });
    expect(f.lastWeek).toEqual({ km: 14, minutes: 84, runs: 2 });
  });

  it('moves the boundary with a Sunday start', () => {
    // Sunday-start: this week began Sun 11-01, so the Sunday run moves into this week.
    const f = facts(acts, { weekStartsOn: 0 });
    expect(f.week.runs).toBe(3);
    expect(f.week.km).toBe(22);
    expect(f.lastWeek).toEqual({ km: 4, minutes: 24, runs: 1 });
  });

  it('counts only outings on foot towards the weekly load', () => {
    const f = facts([run('r', 1, 5), run('ride', 1, 40, { activityType: 'ride' })]);
    expect(f.week.km).toBe(5);
    expect(f.longestKm14).toBe(5);
  });

  it('finds the longest outing in the last 14 days only', () => {
    expect(facts(acts).longestKm14).toBe(10);
    expect(facts([run('a', 13, 8), run('b', 14, 15)]).longestKm14).toBe(8);
  });
});

describe('coachFacts: not training', () => {
  it('leaves out mocked and commute activities everywhere', () => {
    const f = facts([
      run('real', 1, 5),
      run('fake', 1, 30, { mocked: true, effort: 'max' }),
      run('commute', 0, 20, { isCommute: true, effort: 'max', feel: 'terrible' }),
    ]);
    expect(f.week.runs).toBe(1);
    expect(f.longestKm14).toBe(5);
    expect(f.daysSinceHard).toBeNull();
    expect(f.lastFeel).toBeNull();
  });
});

describe('coachFacts: hard days and feel', () => {
  it('measures days since the last hard run and counts distinct hard days in 7', () => {
    const f = facts([
      run('a', 2, 5, { effort: 'hard' }),
      run('b', 2, 3, { effort: 'max' }), // same day: counts once
      run('c', 5, 6, { effort: 'hard' }),
      run('d', 9, 6, { effort: 'hard' }), // older than 7 days
      run('e', 1, 4, { effort: 'easy' }),
    ]);
    expect(f.daysSinceHard).toBe(2);
    expect(f.hardDays7).toBe(2);
  });

  it('takes a hard run from a debrief', () => {
    const f = facts([run('a', 0, 5)], { debriefs: { a: debrief({ effort: 8 }) } });
    expect(f.daysSinceHard).toBe(0);
    expect(f.hardDays7).toBe(1);
  });

  it('reports the most recent feel, preferring the debrief and mapping tough to bad', () => {
    const f = facts([run('a', 3, 5, { feel: 'great' }), run('b', 1, 5, { feel: 'good' })], {
      debriefs: { b: debrief({ feel: 'tough' }) },
    });
    expect(f.lastFeel).toEqual({ feel: 'bad', daysAgo: 1 });
  });

  it('has no feel when nothing was marked', () => {
    expect(facts([run('a', 1, 5)]).lastFeel).toBeNull();
  });

  it('ignores activities from the future', () => {
    expect(facts([run('a', -1, 5, { effort: 'hard', feel: 'bad' })]).daysSinceHard).toBeNull();
  });
});

describe('coachFacts: goals and review', () => {
  const goals: Goal[] = [
    { id: 'g1', metric: 'distance', period: 'week', target: 20_000 },
    { id: 'g2', metric: 'activities', period: 'week', target: 2 },
  ];

  it('reports each goal in km or counts, with how far along it is', () => {
    const f = facts([run('a', 1, 12.34), run('b', 0, 3)], { goals });
    expect(f.goals).toEqual([
      expect.objectContaining({
        title: 'Weekly distance',
        metric: 'distance',
        done: 15.3,
        target: 20,
        reached: false,
      }),
      expect.objectContaining({ metric: 'activities', done: 2, target: 2, reached: true }),
    ]);
  });

  it('keeps at most five goals', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ ...goals[0], id: `g${i}` }) as Goal);
    expect(facts([], { goals: many }).goals).toHaveLength(5);
  });

  it('carries the latest review next-run advice', () => {
    const review = (nextRun: string, createdAt: number): SavedReview => ({
      review: { headline: 'h', summary: 's', wentWell: [], vitals: [], improve: [], nextRun },
      receipts: [],
      createdAt,
    });
    const f = facts([], { reviews: { a: review('Easy 5 km', 100), b: review('Rest day', 200) } });
    expect(f.nextRun).toBe('Rest day');
    expect(facts([], { reviews: { a: review('  ', 1) } }).nextRun).toBeNull();
  });
});
