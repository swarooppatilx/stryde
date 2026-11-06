/**
 * How far one athlete can be paid for in a UTC day. A recorded distance is what the athlete's own app
 * reported, so the mint is bounded here: a made-up thousand-kilometre activity can still be recorded, but
 * it cannot be turned into an unbounded amount of STRD.
 */
export const DEFAULT_DAILY_REWARD_METERS = 200_000;

export function dailyRewardMeters(): number {
  const raw = process.env.STRD_DAILY_REWARD_METERS;
  const configured = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_DAILY_REWARD_METERS;
}

const day = (now: Date) => now.toISOString().slice(0, 10);

export class RewardLedger {
  private used = new Map<string, number>();

  constructor(private readonly limit: () => number = dailyRewardMeters) {}

  private key(wallet: string, now: Date) {
    return `${day(now)}:${wallet.toLowerCase()}`;
  }

  /** Sets `meters` aside for `wallet` today; false, taking nothing, when that would pass the limit. */
  reserve(wallet: string, meters: number, now = new Date()): boolean {
    const key = this.key(wallet, now);
    const spent = this.used.get(key) ?? 0;
    if (spent + meters > this.limit()) return false;
    for (const old of this.used.keys()) if (!old.startsWith(day(now))) this.used.delete(old);
    this.used.set(key, spent + meters);
    return true;
  }

  /** Gives back a reservation whose mint did not happen. */
  release(wallet: string, meters: number, now = new Date()): void {
    const key = this.key(wallet, now);
    const spent = this.used.get(key) ?? 0;
    this.used.set(key, Math.max(0, spent - meters));
  }

  remaining(wallet: string, now = new Date()): number {
    return Math.max(0, this.limit() - (this.used.get(this.key(wallet, now)) ?? 0));
  }
}

export const rewardLedger = new RewardLedger();

export const DAILY_REWARD_MESSAGE =
  "That's today's reward allowance used. Your run is saved and can be rewarded after midnight UTC.";
