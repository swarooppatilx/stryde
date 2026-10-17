import { describe, expect, it } from 'vitest';
import type { LogEntry } from '@/utils/logBuffer';
import { filterLogs, formatLogLine, formatLogTime } from '@/utils/logView';

const entry = (over: Partial<LogEntry>): LogEntry => ({
  id: 1,
  time: new Date(2026, 9, 20, 12, 5, 9, 42).getTime(),
  level: 'info',
  message: 'hello',
  ...over,
});

describe('formatLogTime', () => {
  it('shows local clock time with milliseconds', () => {
    expect(formatLogTime(new Date(2026, 9, 20, 12, 5, 9, 42).getTime())).toBe('12:05:09.042');
  });
});

describe('formatLogLine', () => {
  it('puts time, level and the message on one line', () => {
    expect(formatLogLine(entry({ level: 'warn', message: '[Sync] slow' }))).toBe(
      '12:05:09.042 WARN [Sync] slow'
    );
  });
});

describe('filterLogs', () => {
  const entries = [
    entry({ id: 1, level: 'debug', message: 'd' }),
    entry({ id: 2, level: 'info', namespace: 'Sync', message: '[Sync] started' }),
    entry({ id: 3, level: 'warn', namespace: 'PostRun', message: '[PostRun] photo failed' }),
    entry({ id: 4, level: 'error', message: 'boom' }),
  ];

  it('keeps entries at or above the chosen level', () => {
    expect(filterLogs(entries, { minLevel: 'warn', query: '' }).map((e) => e.id)).toEqual([4, 3]);
    expect(filterLogs(entries, { minLevel: 'debug', query: '' })).toHaveLength(4);
  });

  it('matches text in the message, ignoring case', () => {
    expect(filterLogs(entries, { minLevel: 'debug', query: 'PHOTO' }).map((e) => e.id)).toEqual([
      3,
    ]);
  });

  it('shows the newest first', () => {
    expect(filterLogs(entries, { minLevel: 'debug', query: '' }).map((e) => e.id)).toEqual([
      4, 3, 2, 1,
    ]);
  });
});
