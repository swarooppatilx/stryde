import type { ZeroGReceipt } from '@/services/coachService';
import { formatUsdMicro, type TrustChip, trustChip } from '@/utils/zeroGTrust';

export type CoachRequestKind = 'plan' | 'review' | 'poster' | 'debrief';

/** One result's 0G calls, as the API logged them. */
export interface CoachRequestEntry {
  at: number;
  kind: CoachRequestKind;
  calls: {
    requestId: string | null;
    model: string;
    teeVerified: boolean | null;
    trustMode: 'standard' | 'verified' | 'private' | null;
    costUsdMicro: number | null;
  }[];
  costUsdMicro: number | null;
  adjusted: boolean;
}

const KIND_LABEL: Record<CoachRequestKind, string> = {
  plan: 'Daily plan',
  review: 'Run review',
  poster: 'Run poster',
  debrief: 'Voice debrief',
};

export const kindLabel = (kind: CoachRequestKind): string => KIND_LABEL[kind] ?? kind;

/** "Daily plan · adjusted for safety" or just the kind. */
export function entryTitle(entry: CoachRequestEntry): string {
  const base = kindLabel(entry.kind);
  return entry.adjusted ? `${base} · adjusted for safety` : base;
}

/** "Today 14:05", "Yesterday 09:30" or "3 Nov 18:20", in the athlete's own time. */
export function entryTime(at: number, now: Date): string {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return '';
  const hh = String(when.getHours()).padStart(2, '0');
  const mm = String(when.getMinutes()).padStart(2, '0');
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(now) - midnight(when)) / 86_400_000);
  if (days === 0) return `Today ${hh}:${mm}`;
  if (days === 1) return `Yesterday ${hh}:${mm}`;
  const month = when.toLocaleString('en-GB', { month: 'short' });
  return `${when.getDate()} ${month} ${hh}:${mm}`;
}

/** The TEE chip for one entry, from its calls. */
export function entryTrust(entry: CoachRequestEntry): TrustChip | null {
  const receipts: ZeroGReceipt[] = entry.calls.map((c) => ({ ...c, provider: null }));
  return trustChip(receipts);
}

export const entryCost = (entry: CoachRequestEntry): string | null =>
  formatUsdMicro(entry.costUsdMicro);

/** Newest first; a log that arrives in another order is sorted rather than trusted. */
export function newestFirst(entries: readonly CoachRequestEntry[]): CoachRequestEntry[] {
  return [...entries].sort((a, b) => b.at - a.at);
}
