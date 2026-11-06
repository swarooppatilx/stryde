import { type Address, toAddress } from './address.js';
import type { ClubChain } from './clubs.js';
import { groupRegistryAbi } from './relayAbis.js';

interface ChainReader {
  readContract(params: {
    address: `0x${string}`;
    abi: typeof groupRegistryAbi;
    functionName: 'getGroup' | 'isMember';
    args: readonly unknown[];
  }): Promise<unknown>;
}

/** Owner and membership straight from GroupRegistry. A dissolved or unknown club has no owner. */
export function createClubChain(client: ChainReader, registry: `0x${string}`): ClubChain {
  return {
    async owner(clubId) {
      const group = (await client.readContract({
        address: registry,
        abi: groupRegistryAbi,
        functionName: 'getGroup',
        args: [BigInt(clubId)],
      })) as { owner: string; active: boolean };
      return group.active ? (toAddress(group.owner) as Address | null) : null;
    },
    async isMember(clubId, member) {
      return (await client.readContract({
        address: registry,
        abi: groupRegistryAbi,
        functionName: 'isMember',
        args: [BigInt(clubId), member],
      })) as boolean;
    },
  };
}
