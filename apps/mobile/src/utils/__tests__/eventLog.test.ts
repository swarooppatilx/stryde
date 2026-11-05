import { describe, expect, it } from 'vitest';
import { createEventLog, EVENT_LOG_CAPACITY } from '@/utils/eventLog';

const clockAt = (t: { v: number }) => ({ now: () => t.v });

describe('eventLog', () => {
  it('records events with the injected clock', () => {
    const t = { v: 10 };
    const log = createEventLog(clockAt(t), 'abc');
    log.record('activity.saved');
    t.v = 20;
    log.record('activity.confirmed', { durationMs: 10, ok: true });
    expect(log.snapshot()).toEqual([
      { at: 10, name: 'activity.saved', run: 'abc' },
      { at: 20, name: 'activity.confirmed', durationMs: 10, ok: true, run: 'abc' },
    ]);
  });

  it('keeps a summary of counts with the event, as a copy', () => {
    const log = createEventLog(clockAt({ v: 1 }), 'abc');
    const counts = { accuracy: 3, speed: 0 };
    log.record('record.rejections', { counts });
    counts.accuracy = 99;

    expect(log.snapshot()).toEqual([
      { at: 1, name: 'record.rejections', counts: { accuracy: 3, speed: 0 }, run: 'abc' },
    ]);
  });

  it('keeps only the newest 200', () => {
    const t = { v: 0 };
    const log = createEventLog(clockAt(t));
    for (let i = 0; i < EVENT_LOG_CAPACITY + 5; i++) {
      t.v = i;
      log.record('activity.saved');
    }
    const snap = log.snapshot();
    expect(snap).toHaveLength(EVENT_LOG_CAPACITY);
    expect(snap[0]?.at).toBe(5);
  });

  it('hands out copies', () => {
    const log = createEventLog(clockAt({ v: 1 }));
    log.record('activity.confirmed', { ok: false });
    const first = log.snapshot()[0];
    if (first) first.at = 99;
    expect(log.snapshot()[0]?.at).toBe(1);
  });

  it('uses a short random run tag', () => {
    const log = createEventLog(clockAt({ v: 1 }));
    log.record('activity.saved');
    expect(log.snapshot()[0]?.run).toMatch(/^[a-z0-9]{1,6}$/);
  });
});
