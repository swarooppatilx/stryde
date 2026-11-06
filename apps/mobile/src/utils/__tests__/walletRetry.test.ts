import { describe, expect, it } from 'vitest';
import { walletRetryDelayMs } from '@/utils/walletRetry';

describe('walletRetryDelayMs', () => {
  it('waits longer after each failed attempt', () => {
    expect(walletRetryDelayMs(1)).toBe(15_000);
    expect(walletRetryDelayMs(2)).toBe(30_000);
    expect(walletRetryDelayMs(3)).toBe(60_000);
  });

  it('never waits more than two minutes, so a recovered connection is noticed', () => {
    expect(walletRetryDelayMs(4)).toBe(120_000);
    expect(walletRetryDelayMs(40)).toBe(120_000);
  });

  it('treats a count below one as the first failure', () => {
    expect(walletRetryDelayMs(0)).toBe(15_000);
  });
});
