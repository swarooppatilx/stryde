import type { Hex } from 'viem';
import { zeroAddress } from 'viem';
import type { MirrorSource, RawLog } from './mirror.js';
import { MIRRORED, type MirroredContract } from './mirrorEvents.js';
import type { Address } from './types.js';

/** The slice of a viem public client the source uses, so a test can stand in for the chain. */
export interface MirrorClient {
  getBlock(
    args: { blockTag: 'latest' } | { blockNumber: bigint }
  ): Promise<{ number: bigint; hash: Hex; timestamp: bigint }>;
  getLogs(args: {
    address: Address;
    events: unknown[];
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<
    Array<{
      eventName?: string;
      args: Record<string, unknown>;
      blockNumber: bigint;
      logIndex: number;
    }>
  >;
}

/** The events each contract contributes, grouped once. */
const EVENTS_BY_CONTRACT = (() => {
  const grouped = new Map<MirroredContract, unknown[]>();
  for (const spec of Object.values(MIRRORED)) {
    grouped.set(spec.contract, [...(grouped.get(spec.contract) ?? []), spec.abi]);
  }
  return grouped;
})();

/** Reads the mirrored events straight from the chain, one `getLogs` per contract. */
export function createChainMirrorSource(
  client: MirrorClient,
  contracts: Record<MirroredContract, Address>
): MirrorSource {
  return {
    async head() {
      const block = await client.getBlock({ blockTag: 'latest' });
      return { number: block.number, hash: block.hash };
    },

    async hashAt(block) {
      try {
        return (await client.getBlock({ blockNumber: block })).hash;
      } catch {
        return null;
      }
    },

    async events(from, to) {
      const logs: RawLog[] = [];
      for (const [contract, events] of EVENTS_BY_CONTRACT) {
        const address = contracts[contract];
        if (!address || address === zeroAddress) continue;
        const found = await client.getLogs({ address, events, fromBlock: from, toBlock: to });
        for (const log of found) {
          if (!log.eventName) continue;
          logs.push({
            name: log.eventName,
            args: log.args,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
          });
        }
      }
      return logs;
    },

    async timestampAt(block) {
      return Number((await client.getBlock({ blockNumber: block })).timestamp);
    },
  };
}
