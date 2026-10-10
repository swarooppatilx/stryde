import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { SANDBOX_START_ETH_WEI, SANDBOX_START_STRD_WEI, sandboxBalanceReader, useSandboxBalances } =
  await import('@/backends/sandbox/sandboxBalances');

beforeEach(() => {
  installFakePlatform();
  useSandboxBalances.getState().reset();
});

describe('sandbox balances', () => {
  it('start with believable amounts, so the profile has something to show', () => {
    const { eth, strd } = useSandboxBalances.getState();

    expect(BigInt(eth)).toBe(SANDBOX_START_ETH_WEI);
    expect(BigInt(strd)).toBe(SANDBOX_START_STRD_WEI);
    expect(SANDBOX_START_ETH_WEI).toBeGreaterThan(0n);
    expect(SANDBOX_START_STRD_WEI).toBeGreaterThan(0n);
  });

  it('grow the token balance when a reward is minted', () => {
    useSandboxBalances.getState().addStrd(5n * 10n ** 18n);

    expect(BigInt(useSandboxBalances.getState().strd)).toBe(
      SANDBOX_START_STRD_WEI + 5n * 10n ** 18n
    );
  });

  it('keep adding up across rewards', () => {
    useSandboxBalances.getState().addStrd(1n);
    useSandboxBalances.getState().addStrd(2n);

    expect(BigInt(useSandboxBalances.getState().strd)).toBe(SANDBOX_START_STRD_WEI + 3n);
  });

  it('return to the starting amounts on reset', () => {
    useSandboxBalances.getState().addStrd(10n ** 18n);
    useSandboxBalances.getState().reset();

    expect(BigInt(useSandboxBalances.getState().strd)).toBe(SANDBOX_START_STRD_WEI);
  });

  it('are what the Sandbox balance reader returns for any address', async () => {
    useSandboxBalances.getState().addStrd(10n ** 18n);

    expect(await sandboxBalanceReader('0x00000000000000000000000000000000000000aa')).toEqual({
      eth: SANDBOX_START_ETH_WEI,
      strd: SANDBOX_START_STRD_WEI + 10n ** 18n,
    });
  });
});
