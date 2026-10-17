import type { LogEntry, LogLevel } from './logBuffer';

const SEVERITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Local clock time with milliseconds, e.g. `12:05:09.042`. */
export function formatLogTime(time: number): string {
  const d = new Date(time);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export function formatLogLine(entry: LogEntry): string {
  return `${formatLogTime(entry.time)} ${entry.level.toUpperCase()} ${entry.message}`;
}

/** Entries at or above `minLevel` whose message contains `query`, newest first. */
export function filterLogs(
  entries: readonly LogEntry[],
  { minLevel, query }: { minLevel: LogLevel; query: string }
): LogEntry[] {
  const needle = query.trim().toLowerCase();
  return entries
    .filter(
      (e) =>
        SEVERITY[e.level] >= SEVERITY[minLevel] &&
        (needle === '' || e.message.toLowerCase().includes(needle))
    )
    .reverse();
}
