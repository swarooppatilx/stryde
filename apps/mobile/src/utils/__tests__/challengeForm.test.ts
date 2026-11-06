import { describe, expect, it } from 'vitest';
import {
  opponentLabel,
  parseDecimal,
  stakeShortfall,
  validateChallenge,
} from '@/utils/challengeForm';

describe('parseDecimal', () => {
  it.each([
    ['5', 5],
    ['5.5', 5.5],
    ['5,5', 5.5],
    [' 0.01 ', 0.01],
  ])('reads %j as %d', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each([[''], ['abc'], ['-3'], ['1.2.3'], ['5km']])('rejects %j', (input) => {
    expect(parseDecimal(input)).toBeNull();
  });
});

describe('validateChallenge', () => {
  const base = {
    opponent: '0x00000000000000000000000000000000000000bb',
    distanceInput: '5',
    metersPerUnit: 1000,
    stakeInput: '0.01',
    balanceWei: 10n ** 17n, // 0.1 ETH
  };

  it('accepts a normal challenge and returns the numbers to send', () => {
    expect(validateChallenge(base)).toEqual({
      ok: true,
      targetMeters: 5000,
      stakeWei: 10n ** 16n,
    });
  });

  it('accepts a very small stake instead of calling it zero', () => {
    const result = validateChallenge({ ...base, stakeInput: '0.0000001', balanceWei: null });

    expect(result).toEqual({ ok: true, targetMeters: 5000, stakeWei: 10n ** 11n });
  });

  it('turns miles into meters for imperial users', () => {
    const result = validateChallenge({ ...base, distanceInput: '3', metersPerUnit: 1609.344 });

    expect(result).toMatchObject({ ok: true, targetMeters: 4828 });
  });

  it('says what is missing, in the order the user fills the form', () => {
    expect(validateChallenge({ ...base, opponent: null })).toEqual({
      ok: false,
      reason: 'Pick who to challenge',
      field: 'opponent',
    });
    expect(validateChallenge({ ...base, distanceInput: '0' })).toEqual({
      ok: false,
      reason: 'Enter a target distance above 0',
      field: 'distance',
    });
    expect(validateChallenge({ ...base, stakeInput: '' })).toEqual({
      ok: false,
      reason: 'Enter a stake above 0 ETH',
      field: 'stake',
    });
  });

  it('refuses a stake the account cannot cover, and says how much it has', () => {
    const result = validateChallenge({ ...base, stakeInput: '1', balanceWei: 5n * 10n ** 15n });

    expect(result).toEqual({
      ok: false,
      reason: 'Not enough ETH: your account has 0.005 ETH',
      field: 'stake',
    });
  });

  it('does not block on an unknown balance (it may just not have loaded)', () => {
    expect(validateChallenge({ ...base, balanceWei: null })).toMatchObject({ ok: true });
  });

  it('caps absurd distances', () => {
    expect(validateChallenge({ ...base, distanceInput: '5000' })).toEqual({
      ok: false,
      reason: 'Target distance is too large (max 1,000 km)',
      field: 'distance',
    });
  });
});

describe('opponentLabel', () => {
  const wallet = '0x1111111111111111111111111111111111111111';

  it('shows a name with the short address beside it, so the name is never the only identity', () => {
    expect(opponentLabel('asha.eth', wallet)).toBe('asha.eth (0x1111…1111)');
  });

  it('shows the short address once when there is no name, or the name is the address', () => {
    expect(opponentLabel('', wallet)).toBe('0x1111…1111');
    expect(opponentLabel('0x1111…1111', wallet)).toBe('0x1111…1111');
  });
});

describe('stakeShortfall', () => {
  it('is null when the wallet covers the stake exactly', () => {
    expect(stakeShortfall(10n ** 15n, 10n ** 15n)).toBeNull();
  });

  it('names the stake and the balance when the wallet is short', () => {
    expect(stakeShortfall(0n, 10n ** 15n)).toBe(
      'Matching this stake takes 0.001 ETH and your wallet has 0 ETH.'
    );
  });

  it('is null while the balance is still loading, so a slow read does not block accepting', () => {
    expect(stakeShortfall(null, 10n ** 15n)).toBeNull();
  });
});
