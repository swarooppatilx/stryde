import { describe, expect, it } from 'vitest';
import { FakeClock, installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { createSandboxChain } = await import('@/backends/sandbox/sandboxChain');
const { useSandboxBalances } = await import('@/backends/sandbox/sandboxBalances');

const record = (chain: ReturnType<typeof createSandboxChain>) =>
  chain.recordActivity({
    polyline: '',
    activityType: 'run',
    distance: 1000,
    duration: 1,
    territoryArea: 0,
    metadata: 'x',
  });

describe('sandbox chain', () => {
  it('confirms every step, so a saved run counts as recorded', async () => {
    const chain = createSandboxChain(new FakeClock());

    const recorded = await record(chain);

    expect(recorded.confirmed).toBe(true);
    expect(recorded.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(await chain.setMetadata(recorded.onchainActivityId, { name: 'x' })).toMatchObject({
      confirmed: true,
    });
    expect(await chain.mintReward('0x00', 1000)).toMatchObject({ confirmed: true });
    expect(await chain.claimTerritory([], 10)).toMatchObject({ confirmed: true });
    expect(await chain.mintTerritoryNft('0x00')).toMatchObject({ confirmed: true });
  });

  it('gives each recorded activity its own id and transaction hash', async () => {
    const clock = new FakeClock();
    const chain = createSandboxChain(clock);

    const a = await record(chain);
    clock.advance(1);
    const b = await record(chain);

    expect(a.onchainActivityId).not.toBe(b.onchainActivityId);
    expect(a.txHash).not.toBe(b.txHash);
  });

  it('gives a stable id even for two activities recorded in the same millisecond', async () => {
    const chain = createSandboxChain(new FakeClock());

    const a = await record(chain);
    const b = await record(chain);

    expect(a.onchainActivityId).not.toBe(b.onchainActivityId);
  });

  it('adds a minted reward to the Sandbox token balance, so the profile shows it grow', async () => {
    useSandboxBalances.getState().reset();
    const before = BigInt(useSandboxBalances.getState().strd);
    const chain = createSandboxChain(new FakeClock());

    const reward = await chain.mintReward('0x00', 5000);

    expect(reward.amount).toBeGreaterThan(0n);
    expect(BigInt(useSandboxBalances.getState().strd)).toBe(before + reward.amount);
  });
});
