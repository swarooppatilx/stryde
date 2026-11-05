import type { OutboxEntry } from '@/backends/outbox/outbox';

export type Delivery = 'sending' | 'retrying' | 'failed';

/** Where an item's change stands: undefined once it has been delivered (or never queued). */
export function deliveryOf(entries: readonly OutboxEntry[], key: string): Delivery | undefined {
  const entry = entries.find((e) => e.key === key);
  if (!entry) return undefined;
  if (entry.status === 'failed') return 'failed';
  return entry.attempts > 0 ? 'retrying' : 'sending';
}

/** The queued changes behind `keys` that gave up and wait for the athlete to try again. */
export function failedEntryIds(entries: readonly OutboxEntry[], keys: readonly string[]): string[] {
  const wanted = new Set(keys);
  return entries
    .filter((e) => e.status === 'failed' && e.key !== undefined && wanted.has(e.key))
    .map((e) => e.id);
}

/** How long a change may keep failing, online, since its first failure before it is called slow. */
export const STUCK_AFTER_MS = 2 * 60 * 1000;

export type DeliveryState = 'sending' | 'retrying' | 'waiting-for-network' | 'stuck' | 'failed';

export interface DeliveryContext {
  now: number;
  online: boolean;
}

export interface DeliveryDescription {
  state: DeliveryState;
  ageMs: number;
}

/** Where one queued change stands, given the time and whether the device has a connection. */
export function describeDelivery(entry: OutboxEntry, ctx: DeliveryContext): DeliveryDescription {
  const ageMs = Math.max(0, ctx.now - entry.createdAt);
  if (entry.status === 'failed') return { state: 'failed', ageMs };
  if (!ctx.online) return { state: 'waiting-for-network', ageMs };
  if (entry.attempts > 0 && ctx.now - (entry.firstFailedAt ?? entry.createdAt) > STUCK_AFTER_MS)
    return { state: 'stuck', ageMs };
  return { state: entry.attempts > 0 ? 'retrying' : 'sending', ageMs };
}

/** `describeDelivery` for the change behind `key`; undefined once it has been delivered. */
export function deliveryStateOf(
  entries: readonly OutboxEntry[],
  key: string,
  ctx: DeliveryContext
): DeliveryState | undefined {
  const entry = entries.find((e) => e.key === key);
  return entry ? describeDelivery(entry, ctx).state : undefined;
}
