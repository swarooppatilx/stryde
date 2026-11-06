import type { OutboxEntry } from '@/backends/outbox/outbox';
import { countRegular } from '@/utils/plural';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A rounded-down span: "5 minutes", "3 hours", "2 days", or "under a minute". */
export function formatSpan(ms: number): string {
  if (ms >= DAY) return countRegular(Math.floor(ms / DAY), 'day');
  if (ms >= HOUR) return countRegular(Math.floor(ms / HOUR), 'hour');
  if (ms >= MINUTE) return countRegular(Math.floor(ms / MINUTE), 'minute');
  return 'under a minute';
}

/** The one line logged when the saved queue comes back with changes in it; null when it is empty. */
export function formatBacklog(
  entries: readonly Pick<OutboxEntry, 'createdAt'>[],
  now: number
): string | null {
  if (entries.length === 0) return null;
  const oldest = Math.max(0, now - Math.min(...entries.map((e) => e.createdAt)));
  return `[Outbox] ${countRegular(entries.length, 'change')} waiting at startup, oldest ${formatSpan(oldest)}`;
}
