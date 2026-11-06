import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_DAILY_REWARD_METERS, dailyRewardMeters, RewardLedger } from '../rewardLimit.js';

const WALLET = '0x00000000000000000000000000000000000000aa';
const DAY = new Date('2026-11-06T10:00:00Z');
const NEXT_DAY = new Date('2026-11-07T00:00:01Z');

afterEach(() => {
  delete process.env.STRD_DAILY_REWARD_METERS;
});

describe('RewardLedger', () => {
  it('takes meters until the day’s limit and refuses the one that would pass it', () => {
    const ledger = new RewardLedger(() => 10_000);
    expect(ledger.reserve(WALLET, 6_000, DAY)).toBe(true);
    expect(ledger.reserve(WALLET, 4_000, DAY)).toBe(true);
    expect(ledger.reserve(WALLET, 1, DAY)).toBe(false);
    expect(ledger.remaining(WALLET, DAY)).toBe(0);
  });

  it('counts a wallet’s address in any letter case as one athlete', () => {
    const ledger = new RewardLedger(() => 5_000);
    ledger.reserve(WALLET.toUpperCase().replace('0X', '0x'), 5_000, DAY);
    expect(ledger.reserve(WALLET, 1, DAY)).toBe(false);
  });

  it('starts a fresh allowance at midnight UTC', () => {
    const ledger = new RewardLedger(() => 5_000);
    ledger.reserve(WALLET, 5_000, DAY);
    expect(ledger.reserve(WALLET, 5_000, NEXT_DAY)).toBe(true);
  });

  it('gives back a released reservation and never goes below zero', () => {
    const ledger = new RewardLedger(() => 5_000);
    ledger.reserve(WALLET, 3_000, DAY);
    ledger.release(WALLET, 3_000, DAY);
    ledger.release(WALLET, 3_000, DAY);
    expect(ledger.remaining(WALLET, DAY)).toBe(5_000);
  });
});

describe('dailyRewardMeters', () => {
  it('reads STRD_DAILY_REWARD_METERS and falls back on nonsense', () => {
    expect(dailyRewardMeters()).toBe(DEFAULT_DAILY_REWARD_METERS);
    process.env.STRD_DAILY_REWARD_METERS = '50000';
    expect(dailyRewardMeters()).toBe(50_000);
    process.env.STRD_DAILY_REWARD_METERS = 'lots';
    expect(dailyRewardMeters()).toBe(DEFAULT_DAILY_REWARD_METERS);
  });
});
