import { describe, expect, it } from 'vitest';
import { formatEthAmount, formatTokenAmount, parseEthAmount } from '@/utils/eth';

describe('parseEthAmount', () => {
  it.each([
    ['0.5', 5n * 10n ** 17n],
    [' 1 ', 10n ** 18n],
    ['.5', 5n * 10n ** 17n],
    ['1.', 10n ** 18n],
    ['0.000000000000000001', 1n],
    ['0,1', 10n ** 17n],
    [' 1,5 ', 15n * 10n ** 17n],
  ])('reads %j as wei', (input, wei) => {
    expect(parseEthAmount(input)).toBe(wei);
  });

  it.each(['', '  ', '.', 'abc', '1e3', '-1', '1,2,3', '1,2.3', '1.2.3', '0x10'])(
    'rejects %j',
    (input) => {
      expect(parseEthAmount(input)).toBeNull();
    }
  );

  it('rejects more precision than wei has, instead of quietly rounding money', () => {
    expect(parseEthAmount('0.0000000000000000001')).toBeNull();
    expect(parseEthAmount('0,0000000000000000001')).toBeNull();
  });
});

describe('formatEthAmount', () => {
  it('shows four decimals', () => {
    expect(formatEthAmount(1_234_567_890_000_000_000n)).toBe('1.2346 ETH');
    expect(formatEthAmount(0n)).toBe('0.0000 ETH');
  });
});

describe('formatTokenAmount', () => {
  it('shows two decimals and the symbol', () => {
    expect(formatTokenAmount(12_345_000_000_000_000_000n, 'STRD')).toBe('12.35 STRD');
  });

  it('drops the symbol cleanly when none is wanted, so plain-language labels can follow', () => {
    expect(formatTokenAmount(15_430_000_000_000_000_000n, '')).toBe('15.43');
  });
});
