import { describe, expect, it } from 'vitest';
import { BANNED_USER_WORDS } from '@/constants/copy';
import {
  canConfirmStake,
  type StakeAlertInput,
  stakeAlerts,
  treasuryAmountError,
} from '@/utils/stakeAlerts';

const ME = '0x1111111111111111111111111111111111111111';
const THEM = '0x2222222222222222222222222222222222222222';
const ETH = 10n ** 18n;
const DAY = 24 * 60 * 60;

const base: StakeAlertInput = {
  me: ME,
  opponent: THEM,
  opponentVerified: true,
  stakeWei: ETH / 10n,
  balanceWei: ETH,
  durationSeconds: 7 * DAY,
  hasOpenChallengeWithOpponent: false,
};
const ids = (input: Partial<StakeAlertInput>) =>
  stakeAlerts({ ...base, ...input }).map((a) => a.id);

describe('stakeAlerts', () => {
  it('has nothing to say about an ordinary stake', () => {
    expect(stakeAlerts(base)).toEqual([]);
  });

  it('warns when the opponent is not verified, and skips it when unknown', () => {
    expect(ids({ opponentVerified: false })).toEqual(['opponent-unverified']);
    expect(ids({ opponentVerified: null })).toEqual([]);
  });

  it('warns above half the balance, and not at exactly half', () => {
    expect(ids({ stakeWei: ETH / 2n })).toEqual([]);
    const over = stakeAlerts({ ...base, stakeWei: ETH / 2n + 1n });
    expect(over.map((a) => [a.id, a.severity])).toEqual([['stake-over-half', 'warning']]);
  });

  it('blocks above 90 percent, and not at exactly 90', () => {
    expect(ids({ stakeWei: (ETH * 9n) / 10n })).toEqual(['stake-over-half']);
    const over = stakeAlerts({ ...base, stakeWei: (ETH * 9n) / 10n + 1n });
    expect(over.map((a) => [a.id, a.severity])).toEqual([['stake-over-ninety', 'danger']]);
  });

  it('blocks a stake above the balance', () => {
    const over = stakeAlerts({ ...base, stakeWei: ETH + 1n });
    expect(over.map((a) => [a.id, a.severity])).toEqual([['stake-over-balance', 'danger']]);
  });

  it('warns, needing the understood tap, when the balance could not be read', () => {
    const list = stakeAlerts({ ...base, balanceWei: null, stakeWei: 10n * ETH });
    expect(list.map((a) => [a.id, a.severity])).toEqual([['balance-unknown', 'warning']]);
    expect(canConfirmStake(list, false)).toBe(false);
    expect(canConfirmStake(list, true)).toBe(true);
  });

  it('warns when the deadline is under 24 hours, not at exactly 24', () => {
    expect(ids({ durationSeconds: DAY })).toEqual([]);
    expect(ids({ durationSeconds: DAY - 1 })).toEqual(['deadline-soon']);
  });

  it('blocks the zero address, the burn address and yourself', () => {
    const zero = '0x0000000000000000000000000000000000000000';
    const burn = '0x000000000000000000000000000000000000dEaD';
    expect(stakeAlerts({ ...base, opponent: zero })[0]).toMatchObject({
      id: 'opponent-unusable',
      severity: 'danger',
    });
    expect(ids({ opponent: burn })).toEqual(['opponent-unusable']);
    expect(ids({ opponent: ME.toUpperCase().replace('0X', '0x') })).toEqual(['opponent-self']);
  });

  it('notes an open challenge with the same opponent as info', () => {
    expect(stakeAlerts({ ...base, hasOpenChallengeWithOpponent: true })).toEqual([
      expect.objectContaining({ id: 'open-challenge', severity: 'info' }),
    ]);
  });

  it('lists the most serious first', () => {
    const list = stakeAlerts({
      ...base,
      opponentVerified: false,
      hasOpenChallengeWithOpponent: true,
      stakeWei: ETH + 1n,
    });
    expect(list.map((a) => a.severity)).toEqual(['danger', 'warning', 'info']);
  });

  it('keeps its words plain', () => {
    const everything = stakeAlerts({
      ...base,
      opponent: ME,
      opponentVerified: false,
      stakeWei: 2n * ETH,
      durationSeconds: 1,
      hasOpenChallengeWithOpponent: true,
    });
    for (const alert of everything) expect(alert.message).not.toMatch(BANNED_USER_WORDS);
  });
});

describe('canConfirmStake', () => {
  const alert = (severity: 'info' | 'warning' | 'danger') => ({ id: 'x', severity, message: '' });

  it('allows no alerts and info alerts', () => {
    expect(canConfirmStake([], false)).toBe(true);
    expect(canConfirmStake([alert('info')], false)).toBe(true);
  });

  it('needs the understood tap for warnings', () => {
    expect(canConfirmStake([alert('warning')], false)).toBe(false);
    expect(canConfirmStake([alert('warning')], true)).toBe(true);
  });

  it('never allows a danger, even once understood', () => {
    expect(canConfirmStake([alert('danger'), alert('warning')], true)).toBe(false);
  });
});

describe('treasuryAmountError', () => {
  it('says nothing for an empty box or a fine amount', () => {
    expect(treasuryAmountError('', ETH, 'deposit')).toBeNull();
    expect(treasuryAmountError('0.5', ETH, 'deposit')).toBeNull();
    expect(treasuryAmountError('1', ETH, 'withdraw')).toBeNull();
  });

  it('asks for a larger amount when it is zero or not a number', () => {
    expect(treasuryAmountError('0', ETH, 'deposit')).toBe('Enter a larger amount');
    expect(treasuryAmountError('0.0', ETH, 'withdraw')).toBe('Enter a larger amount');
    expect(treasuryAmountError('abc', ETH, 'deposit')).toBe('Enter a larger amount');
  });

  it('says which side is short', () => {
    expect(treasuryAmountError('1.5', ETH, 'deposit')).toBe('More than your balance');
    expect(treasuryAmountError('1.5', ETH, 'withdraw')).toBe('More than the fund holds');
  });

  it('does not judge against a limit that has not loaded', () => {
    expect(treasuryAmountError('1000', null, 'deposit')).toBeNull();
  });
});
