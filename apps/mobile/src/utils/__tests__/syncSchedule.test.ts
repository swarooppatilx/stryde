import { describe, expect, it } from 'vitest';
import {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  dueForSync,
  MAX_AUTO_ATTEMPTS,
  nextAttemptAt,
} from '@/utils/syncSchedule';

const NOW = new Date('2026-10-20T12:00:00Z').getTime();

function activity(
  id: string,
  over: {
    minutesAgo?: number;
    sync?: { attempts: number; nextAttemptAt: number };
    onchain?: boolean;
  } = {}
) {
  return {
    id,
    createdAt: new Date(NOW - (over.minutesAgo ?? 60) * 60_000),
    ...(over.sync && { sync: over.sync }),
    ...(over.onchain && { onchainActivityId: '1' }),
  };
}

describe('nextAttemptAt', () => {
  it('doubles the wait with each failure', () => {
    expect(nextAttemptAt(NOW, 1)).toBe(NOW + BACKOFF_BASE_MS);
    expect(nextAttemptAt(NOW, 2)).toBe(NOW + BACKOFF_BASE_MS * 2);
    expect(nextAttemptAt(NOW, 3)).toBe(NOW + BACKOFF_BASE_MS * 4);
  });

  it('never waits longer than the cap', () => {
    expect(nextAttemptAt(NOW, 30)).toBe(NOW + BACKOFF_MAX_MS);
  });
});

describe('dueForSync', () => {
  it('picks activities the chain lacks that have never been tried, oldest first', () => {
    const due = dueForSync(
      [activity('new', { minutesAgo: 10 }), activity('old', { minutesAgo: 90 })],
      NOW,
      () => false
    );
    expect(due.map((a) => a.id)).toEqual(['old', 'new']);
  });

  it('skips activities the chain already holds', () => {
    expect(dueForSync([activity('a', { onchain: true })], NOW, () => false)).toEqual([]);
  });

  it('waits for the backoff to pass', () => {
    const waiting = activity('a', { sync: { attempts: 1, nextAttemptAt: NOW + 1 } });
    const ready = activity('b', { sync: { attempts: 1, nextAttemptAt: NOW } });
    expect(dueForSync([waiting, ready], NOW, () => false).map((a) => a.id)).toEqual(['b']);
  });

  it('gives up on its own after the attempt limit, leaving manual retry', () => {
    const spent = activity('a', { sync: { attempts: MAX_AUTO_ATTEMPTS, nextAttemptAt: 0 } });
    expect(dueForSync([spent], NOW, () => false)).toEqual([]);
  });

  it('leaves out what is being recorded right now', () => {
    expect(
      dueForSync([activity('a'), activity('b')], NOW, (id) => id === 'a').map((a) => a.id)
    ).toEqual(['b']);
  });
});
