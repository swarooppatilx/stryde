import { describe, expect, it } from 'vitest';
import { createEventLog } from '@/utils/eventLog';
import type { IndexPollResult } from '@/utils/indexPoll';
import { createTimeToIndexed, formatSeconds } from '@/utils/timeToIndexed';

function setup(result: IndexPollResult) {
  const t = { v: 1000 };
  const clock = { now: () => t.v };
  const log = createEventLog(clock, 'r');
  let signal: AbortSignal | undefined;
  const tracker = createTimeToIndexed({
    clock,
    log,
    poll: async (_h, _o, s) => {
      signal = s;
      t.v += 1100;
      return result;
    },
  });
  return { t, log, tracker, signal: () => signal };
}

describe('timeToIndexed', () => {
  it('records confirmed then indexed with elapsed time', async () => {
    const { t, log, tracker } = setup({ outcome: 'found', at: 5200 });
    tracker.saved('a');
    t.v = 4100;
    tracker.confirmed('a', '0xh', 'o');
    expect(tracker.get('a')).toEqual({ confirmedMs: 3100 });
    await Promise.resolve();
    await Promise.resolve();
    expect(tracker.get('a')).toEqual({ confirmedMs: 3100, indexedMs: 4200 });
    expect(log.snapshot().map((e) => e.name)).toEqual([
      'activity.saved',
      'activity.confirmed',
      'activity.indexed',
    ]);
  });

  it('shows no indexed time when never found', async () => {
    const { tracker } = setup({ outcome: 'gave_up' });
    tracker.saved('a');
    tracker.confirmed('a', '0xh', 'o');
    await Promise.resolve();
    await Promise.resolve();
    expect(tracker.get('a').indexedMs).toBeUndefined();
  });

  it('ignores an activity not saved in this run', () => {
    const { tracker } = setup({ outcome: 'gave_up' });
    tracker.confirmed('zzz', '0xh', 'o');
    expect(tracker.get('zzz')).toEqual({});
  });

  it('cancel aborts the watch', () => {
    const { tracker, signal } = setup({ outcome: 'cancelled' });
    tracker.saved('a');
    tracker.confirmed('a', '0xh', 'o');
    tracker.cancel('a');
    expect(signal()?.aborted).toBe(true);
  });

  it('an old watch finishing does not drop a newer one', async () => {
    const t = { v: 0 };
    const clock = { now: () => t.v };
    const resolvers: Array<(r: IndexPollResult) => void> = [];
    const signals: AbortSignal[] = [];
    const tracker = createTimeToIndexed({
      clock,
      log: createEventLog(clock, 'r'),
      poll: (_h, _o, s) =>
        new Promise<IndexPollResult>((resolve) => {
          resolvers.push(resolve);
          signals.push(s);
        }),
    });
    tracker.saved('a');
    tracker.confirmed('a', '0xh', 'o');
    tracker.cancel('a');
    tracker.confirmed('a', '0xh', 'o');
    resolvers[0]?.({ outcome: 'cancelled' });
    await Promise.resolve();
    await Promise.resolve();
    tracker.cancel('a');
    expect(signals[1]?.aborted).toBe(true);
  });

  it('formats seconds', () => {
    expect(formatSeconds(3140)).toBe('3.1 s');
  });
});
