import { parseAbi, parseAbiItem, zeroAddress } from 'viem';
import type {
  Address,
  ChainIndex,
  ChallengeStatusName,
  IndexedActivity,
  IndexedChallenge,
} from './types.js';

/** Public Sepolia RPCs reject eth_getLogs spans wider than 50,000 blocks. */
export const LOG_WINDOW_BLOCKS = 50_000n;

const ACTIVITY_RECORDED = parseAbiItem(
  'event ActivityRecorded(uint256 indexed activityId, address indexed owner, bytes32 indexed activityHash, uint8 activityType, uint256 distance, uint256 duration, uint256 timestamp, uint256 territoryArea)'
);
const CHALLENGE_CREATED = parseAbiItem(
  'event ChallengeCreated(uint256 indexed challengeId, address indexed challenger, address indexed opponent, uint8 activityType, uint256 targetMetric, uint256 deadline, uint256 stake)'
);
const challengeAbi = parseAbi([
  'function getChallenge(uint256 challengeId) view returns ((address challenger, address opponent, uint256 stake, uint8 activityType, uint256 targetMetric, uint256 deadline, address winner, uint8 status))',
]);
const territoryAbi = parseAbi([
  'function getUserTerritories(address user) view returns (bytes32[])',
  'function getTerritory(bytes32 territoryId) view returns ((address controller, uint256 capturedAt, uint256 lastReinforced, uint256 controlStrength, uint256 areaSqm, bytes32 polygonHash, int32 minLng, int32 minLat, int32 maxLng, int32 maxLat))',
]);

/** Order of `IChallengeRegistry.ChallengeStatus`. */
const STATUS_NAMES: readonly ChallengeStatusName[] = ['Open', 'Accepted', 'Settled', 'Cancelled'];

/** The slice of a viem public client the reader uses, so a test can stand in for the chain. */
export interface IndexClient {
  getBlockNumber(options?: { cacheTime: number }): Promise<bigint>;
  getBlock(args: { blockTag: 'latest' } | { blockNumber: bigint }): Promise<{ timestamp: bigint }>;
  getLogs(args: {
    address: Address;
    event: unknown;
    args?: Record<string, unknown>;
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<Array<{ blockNumber: bigint; args: Record<string, unknown> }>>;
  readContract(args: {
    address: Address;
    abi: unknown;
    functionName: string;
    args: unknown[];
  }): Promise<unknown>;
}

export interface IndexContracts {
  activityRegistry: Address;
  challengeRegistry: Address;
  territoryRegistry: Address;
}

/** Every [from, to] window of at most `LOG_WINDOW_BLOCKS` between two blocks, oldest first. */
function windows(from: bigint, to: bigint): Array<[bigint, bigint]> {
  const out: Array<[bigint, bigint]> = [];
  for (let start = from; start <= to; start += LOG_WINDOW_BLOCKS) {
    const end = start + LOG_WINDOW_BLOCKS - 1n;
    out.push([start, end > to ? to : end]);
  }
  return out;
}

/**
 * Answers from the chain itself: filtered `getLogs` (the athlete and the challenge id are indexed
 * topics, so each query is narrow) and a few contract reads. Always as fresh as the chain; the cost
 * is one RPC round per 50,000 blocks of history, which the Arkiv-backed index removes.
 */
export function createChainIndex(
  client: IndexClient,
  contracts: IndexContracts,
  deployBlock: bigint
): ChainIndex {
  async function logs(
    address: Address,
    event: unknown,
    args: Record<string, unknown>
  ): Promise<Array<{ blockNumber: bigint; args: Record<string, unknown> }>> {
    // Fresh, not viem's cached head (about four seconds old): a run recorded a moment ago would be missed.
    const head = await client.getBlockNumber({ cacheTime: 0 });
    const found: Array<{ blockNumber: bigint; args: Record<string, unknown> }> = [];
    for (const [fromBlock, toBlock] of windows(deployBlock, head)) {
      found.push(...(await client.getLogs({ address, event, args, fromBlock, toBlock })));
    }
    return found;
  }

  return {
    async headTimestamp() {
      return Number((await client.getBlock({ blockTag: 'latest' })).timestamp);
    },

    async challenge(id): Promise<IndexedChallenge | null> {
      const raw = (await client.readContract({
        address: contracts.challengeRegistry,
        abi: challengeAbi,
        functionName: 'getChallenge',
        args: [id],
      })) as {
        challenger: Address;
        opponent: Address;
        activityType: number;
        deadline: bigint;
        status: number;
      };
      // A missing id answers with Solidity's zeroed struct, not a revert.
      if (raw.challenger === zeroAddress) return null;

      const created = (
        await logs(contracts.challengeRegistry, CHALLENGE_CREATED, { challengeId: id })
      )[0];
      // Judging from a guessed start could crown the wrong athlete, so a missing log is an error.
      if (!created) throw new Error(`Could not find the creation of challenge ${id}`);
      const block = await client.getBlock({ blockNumber: created.blockNumber });

      return {
        status: STATUS_NAMES[raw.status] ?? 'Cancelled',
        activityType: Number(raw.activityType),
        deadline: Number(raw.deadline),
        createdAt: Number(block.timestamp),
        challenger: raw.challenger,
        opponent: raw.opponent,
      };
    },

    async activities(user, window): Promise<IndexedActivity[]> {
      const found = await logs(contracts.activityRegistry, ACTIVITY_RECORDED, { owner: user });
      const all = found.map(({ args }) => ({
        user: args.owner as Address,
        activityHash: args.activityHash as `0x${string}`,
        activityType: Number(args.activityType),
        distance: Number(args.distance),
        duration: Number(args.duration),
        timestamp: Number(args.timestamp),
      }));
      if (!window) return all;
      return all.filter((a) => a.timestamp >= window.from && a.timestamp <= window.to);
    },

    async activeTerritoryArea(user) {
      const ids = (await client.readContract({
        address: contracts.territoryRegistry,
        abi: territoryAbi,
        functionName: 'getUserTerritories',
        args: [user],
      })) as `0x${string}`[];
      let area = 0;
      for (const id of ids) {
        const territory = (await client.readContract({
          address: contracts.territoryRegistry,
          abi: territoryAbi,
          functionName: 'getTerritory',
          args: [id],
        })) as { areaSqm: bigint };
        area += Number(territory.areaSqm);
      }
      return area;
    },
  };
}
