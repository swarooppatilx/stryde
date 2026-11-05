import type { Clock } from '@/platform/ports';
import type { ActivityChain } from '@/services/postRun';
import { useSandboxBalances } from './sandboxBalances';

const hex64 = (n: bigint) => `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;

/**
 * Stands in for the chain on the Sandbox profile: every step succeeds at once, with ids and hashes
 * that are unique per call. Nothing leaves the device, and nothing is remembered between launches
 * except what the app itself saves about the activity.
 */
export function createSandboxChain(clock: Clock): ActivityChain {
  let last = 0n;
  const nextId = () => {
    // Time-based so ids from different launches do not collide; bumped when two calls share a millisecond.
    const candidate = BigInt(clock.now());
    last = candidate > last ? candidate : last + 1n;
    return last;
  };

  return {
    async recordActivity() {
      const id = nextId();
      return { onchainActivityId: id, txHash: hex64(id), confirmed: true };
    },
    async setMetadata() {
      const id = nextId();
      return { cid: `sandbox-${id.toString(16)}`, confirmed: true };
    },
    async recordSeasonContribution() {},
    async mintReward(_hash, distance) {
      const amount = BigInt(Math.round(distance)) * 10n ** 15n;
      // There is no token contract to read a balance from, so the Sandbox keeps the running total itself.
      useSandboxBalances.getState().addStrd(amount);
      return { amount, confirmed: true };
    },
    async claimTerritory() {
      return { territoryId: hex64(nextId()), confirmed: true };
    },
    async mintTerritoryNft() {
      return { confirmed: true };
    },
  };
}
