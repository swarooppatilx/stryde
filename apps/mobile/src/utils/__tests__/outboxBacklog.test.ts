import { describe, expect, it } from 'vitest';
import { formatBacklog, formatSpan } from '@/utils/outboxBacklog';

const DAY = 86_400_000;

describe('formatSpan', () => {
  it('rounds down to the largest unit', () => {
    expect(formatSpan(5_000)).toBe('under a minute');
    expect(formatSpan(60_000)).toBe('1 minute');
    expect(formatSpan(5 * 60_000)).toBe('5 minutes');
    expect(formatSpan(3 * 3_600_000 + 59 * 60_000)).toBe('3 hours');
    expect(formatSpan(2 * DAY + 5)).toBe('2 days');
  });
});

describe('formatBacklog', () => {
  it('says nothing for an empty queue', () => {
    expect(formatBacklog([], 1000)).toBeNull();
  });

  it('counts the changes and names the oldest', () => {
    const now = 10 * DAY;
    const entries = [{ createdAt: now - 2 * DAY }, { createdAt: now - 60_000 }, { createdAt: now }];
    expect(formatBacklog(entries, now)).toBe(
      '[Outbox] 3 changes waiting at startup, oldest 2 days'
    );
  });

  it('uses the singular for one change', () => {
    expect(formatBacklog([{ createdAt: 0 }], 3_600_000)).toBe(
      '[Outbox] 1 change waiting at startup, oldest 1 hour'
    );
  });
});
