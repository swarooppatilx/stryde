import { describe, expect, it } from 'vitest';
import type { CoachPlan } from '@/services/coachService';
import type { SavedPlan } from '@/stores/coachStore';
import type { Activity } from '@/types';
import {
  COMMIT_GRACE_MS,
  findPlanRun,
  isKept,
  keptDays,
  planStreak,
  planUpdates,
} from '@/utils/planKept';

const DAY = '2026-11-06';
const plan: CoachPlan = {
  title: 'Easy aerobic run',
  type: 'easy',
  distanceKm: 6,
  durationMin: 38,
  effort: 'easy',
  summary: '',
  steps: [],
  why: '',
};
const committedAt = new Date(2026, 10, 6, 7, 0).getTime();

function run(id: string, at: Date, km: number, min: number, extra: Partial<Activity> = {}) {
  return {
    id,
    userId: 'u',
    activityType: 'run',
    distance: km * 1000,
    duration: min * 60_000,
    polyline: '',
    territory: null,
    territoryArea: 0,
    createdAt: at,
    ...extra,
  } as Activity;
}

const saved = (
  day: string,
  over: Partial<SavedPlan> = {},
  p: Partial<CoachPlan> = {}
): SavedPlan => ({
  day,
  plan: { ...plan, ...p },
  receipts: [],
  createdAt: 0,
  ...over,
});

describe('findPlanRun', () => {
  it('takes the first long-enough run on the plan day after committing', () => {
    const short = run('short', new Date(2026, 10, 6, 8, 0), 2, 12);
    const kept = run('kept', new Date(2026, 10, 6, 17, 0), 4.9, 30);
    const later = run('later', new Date(2026, 10, 6, 19, 0), 7, 40);
    expect(findPlanRun(plan, DAY, committedAt, [later, short, kept])?.id).toBe('kept');
  });

  it('counts 80% of the distance or of the time, and no less', () => {
    expect(
      findPlanRun(plan, DAY, committedAt, [run('d', new Date(2026, 10, 6, 9), 4.8, 5)])?.id
    ).toBe('d');
    expect(
      findPlanRun(plan, DAY, committedAt, [run('t', new Date(2026, 10, 6, 9), 1, 30.4)])?.id
    ).toBe('t');
    expect(
      findPlanRun(plan, DAY, committedAt, [run('x', new Date(2026, 10, 6, 9), 4.79, 30.3)])
    ).toBeNull();
  });

  it('uses only the target that exists', () => {
    const km = { ...plan, durationMin: null };
    expect(
      findPlanRun(km, DAY, committedAt, [run('a', new Date(2026, 10, 6, 9), 1, 60)])
    ).toBeNull();
    const min = { ...plan, distanceKm: null };
    expect(
      findPlanRun(min, DAY, committedAt, [run('a', new Date(2026, 10, 6, 9), 10, 20)])
    ).toBeNull();
    expect(
      findPlanRun(min, DAY, committedAt, [run('b', new Date(2026, 10, 6, 9), 1, 31)])?.id
    ).toBe('b');
  });

  it('ignores other days, even a minute either side of midnight', () => {
    const lateYesterday = run('y', new Date(2026, 10, 5, 23, 59), 10, 60);
    const earlyTomorrow = run('t', new Date(2026, 10, 7, 0, 0), 10, 60);
    expect(findPlanRun(plan, DAY, committedAt, [lateYesterday, earlyTomorrow])).toBeNull();
    const justAfterMidnight = run('m', new Date(2026, 10, 6, 0, 1), 10, 60);
    expect(
      findPlanRun(plan, DAY, new Date(2026, 10, 6, 0, 0).getTime(), [justAfterMidnight])?.id
    ).toBe('m');
  });

  it('allows a run that ended up to an hour before the commitment, not two', () => {
    expect(COMMIT_GRACE_MS).toBe(3_600_000);
    const justBefore = run('jb', new Date(2026, 10, 6, 6, 30), 6, 38);
    const wellBefore = run('wb', new Date(2026, 10, 6, 4, 0), 10, 60);
    expect(findPlanRun(plan, DAY, committedAt, [justBefore])?.id).toBe('jb');
    expect(findPlanRun(plan, DAY, committedAt, [wellBefore])).toBeNull();
  });

  it('has nothing to match on a rest day, and takes any run when no target was set', () => {
    const any = run('any', new Date(2026, 10, 6, 9, 0), 1, 5);
    expect(findPlanRun({ ...plan, type: 'rest' }, DAY, committedAt, [any])).toBeNull();
    const open = { ...plan, distanceKm: null, durationMin: null };
    expect(findPlanRun(open, DAY, committedAt, [any])?.id).toBe('any');
    expect(
      findPlanRun(open, DAY, committedAt, [run('z', new Date(2026, 10, 6, 9), 0, 5)])
    ).toBeNull();
  });

  it('matches a plan saved before plans were structured on any run that day', () => {
    const old = { title: 't', summary: '', steps: [], why: '' } as CoachPlan;
    expect(
      findPlanRun(old, DAY, committedAt, [run('a', new Date(2026, 10, 6, 9), 2, 15)])?.id
    ).toBe('a');
  });

  it('skips mocked and commute activities and unreadable dates', () => {
    const at = new Date(2026, 10, 6, 9, 0);
    expect(
      findPlanRun(plan, DAY, committedAt, [
        run('m', at, 10, 60, { mocked: true }),
        run('c', at, 10, 60, { isCommute: true }),
        run('bad', new Date('nope'), 10, 60),
      ])
    ).toBeNull();
  });
});

describe('planStreak', () => {
  it('counts kept days back from today, or from yesterday while today is open', () => {
    expect(planStreak(['2026-11-04', '2026-11-05', '2026-11-06'], '2026-11-06')).toBe(3);
    expect(planStreak(['2026-11-04', '2026-11-05'], '2026-11-06')).toBe(2);
    expect(planStreak(['2026-11-03', '2026-11-05'], '2026-11-06')).toBe(1);
    expect(planStreak(['2026-11-03'], '2026-11-06')).toBe(0);
    expect(planStreak([], '2026-11-06')).toBe(0);
  });

  it('crosses month and year ends', () => {
    expect(planStreak(['2026-10-31', '2026-11-01'], '2026-11-01')).toBe(2);
    expect(planStreak(['2025-12-31', '2026-01-01'], '2026-01-01')).toBe(2);
  });

  it('is not thrown by a daylight-saving change or a leap day', () => {
    // US clocks changed on 2026-03-08 and 2026-11-01; Europe on 2026-03-29 and 2026-10-25.
    expect(planStreak(['2026-03-07', '2026-03-08', '2026-03-09'], '2026-03-09')).toBe(3);
    expect(planStreak(['2026-10-24', '2026-10-25', '2026-10-26'], '2026-10-26')).toBe(3);
    expect(planStreak(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01')).toBe(3);
  });

  it('counts each day once and ignores gaps older than the streak', () => {
    expect(planStreak(['2026-11-06', '2026-11-06', '2026-11-05'], '2026-11-06')).toBe(2);
    expect(planStreak(['2026-11-06', '2026-11-04'], '2026-11-06')).toBe(1);
  });
});

describe('kept days', () => {
  it('keeps a plan whose run was done, or a rest day the athlete committed to', () => {
    expect(isKept(saved(DAY))).toBe(false);
    expect(isKept(saved(DAY, { committedAt: 1 }))).toBe(false);
    expect(isKept(saved(DAY, { committedAt: 1, doneRunId: 'a' }))).toBe(true);
    expect(isKept(saved(DAY, {}, { type: 'rest' }))).toBe(false);
    expect(isKept(saved(DAY, { committedAt: 1 }, { type: 'rest' }))).toBe(true);
  });

  it('lists the kept days, oldest first', () => {
    const plans = {
      '2026-11-06': saved('2026-11-06', { committedAt: 1, doneRunId: 'b' }),
      '2026-11-04': saved('2026-11-04', { committedAt: 1, doneRunId: 'a' }),
      '2026-11-05': saved('2026-11-05', { committedAt: 1 }),
    };
    expect(keptDays(plans)).toEqual(['2026-11-04', '2026-11-06']);
    expect(keptDays({})).toEqual([]);
  });
});

describe('planUpdates', () => {
  const plans = {
    [DAY]: saved(DAY, { committedAt }),
    '2026-11-05': saved('2026-11-05', { committedAt: new Date(2026, 10, 5, 7).getTime() }),
    '2026-11-04': saved('2026-11-04', {
      committedAt: new Date(2026, 10, 4, 7).getTime(),
      doneRunId: 'already',
    }),
    '2026-11-03': saved('2026-11-03'),
  };

  it('finds the run for each committed plan that is not done yet, today or earlier', () => {
    const activities = [
      run('today', new Date(2026, 10, 6, 17), 6, 40),
      run('yesterday-synced-late', new Date(2026, 10, 5, 18), 6, 40),
      run('for-done-plan', new Date(2026, 10, 4, 18), 6, 40),
      run('for-uncommitted', new Date(2026, 10, 3, 18), 6, 40),
    ];
    expect(planUpdates(plans, activities)).toEqual([
      { day: DAY, runId: 'today' },
      { day: '2026-11-05', runId: 'yesterday-synced-late' },
    ]);
  });

  it('finds nothing when no run is long enough or there are no runs', () => {
    expect(planUpdates(plans, [run('short', new Date(2026, 10, 6, 17), 1, 5)])).toEqual([]);
    expect(planUpdates(plans, [])).toEqual([]);
    expect(planUpdates({}, [run('a', new Date(2026, 10, 6, 17), 6, 40)])).toEqual([]);
  });

  it('never matches a rest day to a run', () => {
    const rest = { [DAY]: saved(DAY, { committedAt }, { type: 'rest' }) };
    expect(planUpdates(rest, [run('a', new Date(2026, 10, 6, 17), 6, 40)])).toEqual([]);
  });
});
