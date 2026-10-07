import { describe, expect, it } from 'vitest';
import type { OutboxEntry } from '@/backends/outbox/outbox';
import { BANNED_USER_WORDS, STAGE_TOAST_COPY } from '@/constants/copy';
import { baselineSeen, planOutboxToasts } from '@/utils/outboxToastPlan';
import { stageKindOf, stageToastFor } from '@/utils/stageToast';

const entry = (over: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id: 'e1',
  kind: 'createPost',
  payload: {},
  key: 'post:1',
  createdAt: 0,
  attempts: 0,
  nextAttemptAt: 0,
  status: 'pending',
  ...over,
});

describe('stageToastFor', () => {
  it('maps each stage to plain copy', () => {
    expect(stageToastFor('sending', 'run').content).toBe('Getting your run ready');
    expect(stageToastFor('sending', 'write').content).toBe('Sending');
    expect(stageToastFor('retrying', 'write').content).toBe('Still trying');
    expect(stageToastFor('failed', 'write')).toMatchObject({
      content: "Couldn't send. Tap to try again",
      retry: true,
      duration: 0,
    });
    expect(stageToastFor('done', 'run')).toMatchObject({ content: 'Counted', kind: 'success' });
    expect(stageToastFor('done', 'run').duration).toBeGreaterThan(0);
  });

  it('says a report was sent, not that it was counted', () => {
    expect(stageToastFor('done', 'report').content).toBe('Report sent');
    expect(stageToastFor('failed', 'report').retry).toBe(true);
  });

  it('keeps plumbing words out of the copy', () => {
    for (const text of Object.values(STAGE_TOAST_COPY)) expect(text).not.toMatch(BANNED_USER_WORDS);
  });

  it('only tracks user-initiated kinds', () => {
    expect(stageKindOf('setKudos')).toBeUndefined();
    expect(stageKindOf('setFollow')).toBeUndefined();
    expect(stageKindOf('setUsername')).toBe('write');
    expect(stageKindOf('createPost')).toBe('run');
    expect(stageKindOf('sendReport')).toBe('report');
  });
});

describe('planOutboxToasts', () => {
  it('stays quiet for entries present at start, even failed ones', () => {
    const failed = entry({ status: 'failed', attempts: 5 });
    const seen = baselineSeen([failed]);
    const plan = planOutboxToasts(seen, [failed]);
    expect(plan.commands).toEqual([]);
  });

  it('announces a new entry, a retry, a failure and completion', () => {
    let seen = baselineSeen([]);
    let plan = planOutboxToasts(seen, [entry()]);
    expect(plan.commands.map((c) => c.toast?.content)).toEqual([STAGE_TOAST_COPY.sendingRun]);
    seen = plan.seen;
    expect(planOutboxToasts(seen, [entry()]).commands).toEqual([]);
    plan = planOutboxToasts(seen, [entry({ attempts: 1 })]);
    expect(plan.commands[0]?.toast?.content).toBe(STAGE_TOAST_COPY.retrying);
    plan = planOutboxToasts(plan.seen, [entry({ attempts: 5, status: 'failed' })]);
    expect(plan.commands[0]?.toast?.retry).toBe(true);
    plan = planOutboxToasts(plan.seen, []);
    expect(plan.commands).toEqual([{ key: 'post:1', toast: stageToastFor('done', 'run') }]);
    expect(planOutboxToasts(plan.seen, []).commands).toEqual([]);
  });

  it('says a refused change was not accepted instead of counting it', () => {
    let plan = planOutboxToasts(baselineSeen([]), [entry()]);
    plan = planOutboxToasts(plan.seen, [], (key) => key === 'post:1');
    expect(plan.commands).toEqual([{ key: 'post:1', toast: stageToastFor('rejected', 'run') }]);
    expect(stageToastFor('rejected', 'run')).toMatchObject({ kind: 'fail', retry: false });
    expect(stageToastFor('rejected', 'run').content).toBe(STAGE_TOAST_COPY.rejected);
  });

  it('announces a pre-existing entry once it changes, and ignores other kinds', () => {
    const before = entry({ attempts: 2 });
    const seen = baselineSeen([before, entry({ id: 'k', kind: 'setKudos', key: 'kudos:1' })]);
    const plan = planOutboxToasts(seen, [
      entry({ attempts: 5, status: 'failed' }),
      entry({ id: 'k', kind: 'setKudos', key: 'kudos:1', attempts: 3 }),
    ]);
    expect(plan.commands).toHaveLength(1);
    expect(plan.commands[0]?.toast?.kind).toBe('fail');
  });

  it('does not announce a pre-existing entry that finishes quietly', () => {
    const seen = baselineSeen([entry()]);
    expect(planOutboxToasts(seen, []).commands).toEqual([]);
  });

  it('takes toasts down without "Counted" when the queue was cleared', () => {
    const first = planOutboxToasts(baselineSeen([]), [entry()]);
    const plan = planOutboxToasts(first.seen, [], () => false, true);
    expect(plan.commands).toEqual([{ key: 'post:1', toast: null }]);
    expect(plan.seen.size).toBe(0);
  });

  it('drops a refusal noted for a key nobody saw, so it cannot colour a later delivery', () => {
    const refusals = new Set(['post:1']);
    const consume = (key: string) => refusals.delete(key);
    const seen = baselineSeen([entry()]);
    expect(planOutboxToasts(seen, [], consume).commands).toEqual([]);
    expect(refusals.size).toBe(0);
    const shown = planOutboxToasts(baselineSeen([]), [entry()]);
    const done = planOutboxToasts(shown.seen, [], consume);
    expect(done.commands).toEqual([{ key: 'post:1', toast: stageToastFor('done', 'run') }]);
  });

  it('shows one toast for two entries filed under the same key', () => {
    const twins = [entry({ id: 'a' }), entry({ id: 'b' })];
    const first = planOutboxToasts(baselineSeen([]), twins);
    expect(first.commands).toHaveLength(1);
    expect(planOutboxToasts(first.seen, twins).commands).toEqual([]);
    expect(planOutboxToasts(first.seen, [...twins].reverse()).commands).toEqual([]);
  });
});
