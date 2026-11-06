import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';
import type { SavedPlan } from '@/stores/coachStore';

installFakePlatform();
const { useCoachStore } = await import('@/stores/coachStore');

const plan = (day: string): SavedPlan => ({
  day,
  plan: { title: 'Easy', summary: '', steps: [], why: '' },
  receipts: [],
  createdAt: 1,
});
const plans = () => useCoachStore.getState().plans;

beforeEach(() => {
  installFakePlatform();
  useCoachStore.getState().reset();
});

describe('coach store: commit and keep a plan', () => {
  it('commits to a saved plan once', () => {
    useCoachStore.getState().savePlan(plan('2026-11-06'));
    useCoachStore.getState().commitPlan('2026-11-06', 1000);
    useCoachStore.getState().commitPlan('2026-11-06', 5000);
    expect(plans()['2026-11-06']?.committedAt).toBe(1000);
  });

  it('marks a plan done once, and keeps the first run', () => {
    useCoachStore.getState().savePlan(plan('2026-11-06'));
    useCoachStore.getState().markPlanDone('2026-11-06', 'run-1');
    useCoachStore.getState().markPlanDone('2026-11-06', 'run-2');
    expect(plans()['2026-11-06']?.doneRunId).toBe('run-1');
  });

  it('ignores a day with no plan', () => {
    useCoachStore.getState().commitPlan('2026-11-06', 1);
    useCoachStore.getState().markPlanDone('2026-11-06', 'run-1');
    expect(plans()).toEqual({});
  });

  it('keeps old plans without the new fields as they were', () => {
    useCoachStore.getState().savePlan(plan('2026-11-05'));
    expect(plans()['2026-11-05']).not.toHaveProperty('committedAt');
    expect(plans()['2026-11-05']).not.toHaveProperty('doneRunId');
  });

  it('a regenerated plan replaces the day, dropping the old commitment', () => {
    useCoachStore.getState().savePlan(plan('2026-11-06'));
    useCoachStore.getState().commitPlan('2026-11-06', 1000);
    useCoachStore.getState().savePlan(plan('2026-11-06'));
    expect(plans()['2026-11-06']?.committedAt).toBeUndefined();
  });

  it('keeps only the latest 30 days of plans', () => {
    for (let i = 1; i <= 35; i++) {
      useCoachStore.getState().savePlan(plan(`2026-10-${String(i).padStart(2, '0')}`));
    }
    expect(Object.keys(plans())).toHaveLength(30);
    expect(plans()['2026-10-01']).toBeUndefined();
    expect(plans()['2026-10-35']).toBeDefined();
  });
});
