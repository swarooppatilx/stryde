import { useEffect, useState, useSyncExternalStore } from 'react';
import { getOutbox } from '@/backends/outbox/appOutbox';
import type { OutboxEntry } from '@/backends/outbox/outbox';
import { getPlatform } from '@/platform';
import {
  type Delivery,
  type DeliveryContext,
  type DeliveryState,
  deliveryOf,
  deliveryStateOf,
  failedEntryIds,
} from '@/utils/deliveryState';
import { useOnline } from './useOnline';

const DRAIN_EVERY_MS = 30_000;

export function useOutboxEntries(): readonly OutboxEntry[] {
  const outbox = getOutbox();
  return useSyncExternalStore(outbox.subscribe, outbox.entries);
}

export function useDelivery(key: string): Delivery | undefined {
  return deliveryOf(useOutboxEntries(), key);
}

const RECHECK_EVERY_MS = 30_000;

/** The time and connection a queued change is judged by; the time is renewed while `active`. */
export function useDeliveryContext(active: boolean): DeliveryContext {
  const online = useOnline();
  const [now, setNow] = useState(() => getPlatform().clock.now());
  useEffect(() => {
    if (!active) return;
    setNow(getPlatform().clock.now());
    const timer = setInterval(() => setNow(getPlatform().clock.now()), RECHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [active]);
  return { now, online };
}

/** Like `useDelivery`, but also says when the change waits for a connection or is taking long. */
export function useDeliveryState(key: string): DeliveryState | undefined {
  const entries = useOutboxEntries();
  const queued = entries.some((e) => e.key === key);
  const ctx = useDeliveryContext(queued);
  return deliveryStateOf(entries, key, ctx);
}

/** Gives the changes behind `keys` that gave up a fresh set of tries, and sends them now. */
export async function retryDeliveries(keys: readonly string[]): Promise<void> {
  const outbox = getOutbox();
  const ids = failedEntryIds(outbox.entries(), keys);
  if (ids.length === 0) return;
  await Promise.all(ids.map((id) => outbox.retry(id)));
  // A delivery pass already under way may have gone by the retried entry; the second one picks it up.
  await outbox.drain();
  await outbox.drain();
}

/** While `enabled`, brings the saved queue back and keeps delivering it: on open, when the connection returns, and every 30 s. */
export function useOutboxDrain(enabled: boolean): void {
  const online = useOnline();
  useEffect(() => {
    if (!enabled) return;
    const outbox = getOutbox();
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    void outbox.hydrate().then(() => {
      if (stopped || !online) return;
      void outbox.drain();
      timer = setInterval(() => void outbox.drain(), DRAIN_EVERY_MS);
    });
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [enabled, online]);
}
