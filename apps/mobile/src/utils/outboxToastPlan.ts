import type { OutboxEntry } from '@/backends/outbox/outbox';
import { type Delivery, deliveryOf } from '@/utils/deliveryState';
import { type StageKind, type StageToast, stageKindOf, stageToastFor } from '@/utils/stageToast';

/** What was last seen for one queued change. `shown` once a toast was raised for it. */
export interface Seen {
  signature: string;
  stage: StageKind;
  shown: boolean;
}

export type SeenMap = ReadonlyMap<string, Seen>;

export interface ToastCommand {
  /** The outbox key: one toast per key. */
  key: string;
  /** What to show; null takes the key's toast down without a word (the change was discarded). */
  toast: StageToast | null;
}

function signatureOf(entry: OutboxEntry, delivery: Delivery): string {
  // Two entries filed under one key show as one toast, so the key and where it stands is all that counts.
  return `${entry.key}:${delivery}`;
}

/** What the queue looked like when the screen opened: remembered, never announced. */
export function baselineSeen(entries: readonly OutboxEntry[]): SeenMap {
  const seen = new Map<string, Seen>();
  for (const entry of entries) {
    const stage = stageKindOf(entry.kind);
    if (!entry.key || !stage) continue;
    const delivery = deliveryOf(entries, entry.key);
    if (delivery)
      seen.set(entry.key, { signature: signatureOf(entry, delivery), stage, shown: false });
  }
  return seen;
}

/**
 * Compares the queue with what was seen before and says which toasts to raise. Only changes the
 * athlete asked for count, and only ones that appear or change after `previous` was taken; a
 * change that left the queue is "done" (or "rejected") once a toast had been raised for it.
 */
export function planOutboxToasts(
  previous: SeenMap,
  entries: readonly OutboxEntry[],
  wasRejected: (key: string) => boolean = () => false,
  /** The queue was wiped (signing out, deleting data): what vanished was discarded, not delivered. */
  cleared = false
): { seen: SeenMap; commands: ToastCommand[] } {
  const seen = new Map<string, Seen>();
  const commands: ToastCommand[] = [];
  for (const entry of entries) {
    const stage = stageKindOf(entry.kind);
    if (!entry.key || !stage) continue;
    const delivery = deliveryOf(entries, entry.key);
    if (!delivery || seen.has(entry.key)) continue;
    const signature = signatureOf(entry, delivery);
    const before = previous.get(entry.key);
    if (before && before.signature === signature) {
      seen.set(entry.key, before);
      continue;
    }
    seen.set(entry.key, { signature, stage, shown: true });
    commands.push({ key: entry.key, toast: stageToastFor(delivery, stage) });
  }
  for (const [key, before] of previous) {
    if (seen.has(key)) continue;
    // Asked for every key that left, so a refusal noted for one nobody saw cannot linger.
    const refused = wasRejected(key);
    if (cleared) {
      if (before.shown) commands.push({ key, toast: null });
    } else if (before.shown) {
      // A change leaves the queue both when it is delivered and when it is refused; only one is "Counted".
      commands.push({
        key,
        toast: stageToastFor(refused ? 'rejected' : 'done', before.stage),
      });
    }
  }
  return { seen, commands };
}
