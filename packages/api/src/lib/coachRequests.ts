import type { CoachFeature } from './coach.js';
import type { TrustMode, ZeroGReceipt } from './zeroG.js';

/** One 0G call behind a coach result: what a judge or the athlete can look up in the router. */
export interface LoggedCall {
  requestId: string | null;
  model: string;
  teeVerified: boolean | null;
  trustMode: TrustMode | null;
  costUsdMicro: number | null;
}

export interface RequestLogEntry {
  /** Epoch ms. */
  at: number;
  kind: CoachFeature;
  calls: LoggedCall[];
  /** Summed over the calls that reported a cost; null when none did. */
  costUsdMicro: number | null;
  /** The safety rules changed the plan after the retry (plans only). */
  adjusted: boolean;
}

const MAX_PER_WALLET = 50;
const MAX_WALLETS = 5_000;

/** Per-wallet log of the coach's 0G calls, newest first. In memory: each server instance keeps its own. */
export class CoachRequestLog {
  private logs = new Map<string, RequestLogEntry[]>();

  record(
    wallet: string,
    kind: CoachFeature,
    receipts: readonly ZeroGReceipt[],
    options: { adjusted?: boolean; now?: number } = {}
  ): void {
    if (receipts.length === 0) return;
    const key = wallet.toLowerCase();
    const known = receipts.filter((r) => r.costUsdMicro !== null);
    const entry: RequestLogEntry = {
      at: options.now ?? Date.now(),
      kind,
      calls: receipts.map((r) => ({
        requestId: r.requestId,
        model: r.model,
        teeVerified: r.teeVerified,
        trustMode: r.trustMode,
        costUsdMicro: r.costUsdMicro,
      })),
      costUsdMicro: known.length ? known.reduce((sum, r) => sum + (r.costUsdMicro ?? 0), 0) : null,
      adjusted: options.adjusted === true,
    };
    const list = this.logs.get(key) ?? [];
    list.unshift(entry);
    list.length = Math.min(list.length, MAX_PER_WALLET);
    if (!this.logs.has(key) && this.logs.size >= MAX_WALLETS) {
      this.logs.delete(this.logs.keys().next().value as string);
    }
    this.logs.set(key, list);
  }

  /** The wallet's own entries, newest first; a copy, so callers can't edit the log. */
  list(wallet: string): RequestLogEntry[] {
    return [...(this.logs.get(wallet.toLowerCase()) ?? [])];
  }
}
