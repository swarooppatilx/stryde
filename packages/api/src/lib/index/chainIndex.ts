import { parseAbi, parseAbiItem, zeroAddress } from 'viem';
import type {
  Address,
  ChainIndex,
  ChallengeStatusName,
  IndexedActivity,
  IndexedChallenge,
} from './types.js';

/** Infura rejects eth_getLogs spans wider than 10,000 blocks. */
export const LOG_WINDOW_BLOCKS = 10_000n;
/** Blocks this far below the head are treated as final (about two Ethereum epochs). */
export const REORG_DEPTH = 64n;
/** getLogs windows read at once; more would trip public RPC rate limits. */
const PARALLEL_WINDOWS = 4;
/** Distinct queries (one per athlete or challenge) whose settled logs are remembered. */
const MAX_CACHED_QUERIES = 2000;

type Log = { blockNumber: bigint; args: Record<string, unknown> };

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
 * topics, so each query is narrow) and a few contract reads. Always as fresh as the chain; the first
 * query costs one RPC round per 50,000 blocks of history, later ones only the blocks since.
 */
export function createChainIndex(
  client: IndexClient,
  contracts: IndexContracts,
  deployBlock: bigint
): ChainIndex {
  // Logs deeper than REORG_DEPTH never change, so each query remembers them and later calls scan
  // only the blocks after. The newest blocks are always read again, since a reorg can still drop them.
  const settledLogs = new Map<string, { upTo: bigint; logs: Log[] }>();

  async function logs(address: Address, event: unknown, args: Record<string, unknown>) {
    // Fresh, not viem's cached head (about four seconds old): a run recorded a moment ago would be missed.
    const head = await client.getBlockNumber({ cacheTime: 0 });
    const key = `${address}:${(event as { name?: string }).name}:${JSON.stringify(args, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v
    )}`;
    const known = settledLogs.get(key);
    const from = known ? known.upTo + 1n : deployBlock;

    const ranges = windows(from, head);
    const fresh: Log[] = [];
    for (let i = 0; i < ranges.length; i += PARALLEL_WINDOWS) {
      const batch = await Promise.all(
        ranges
          .slice(i, i + PARALLEL_WINDOWS)
          .map(([fromBlock, toBlock]) =>
            client.getLogs({ address, event, args, fromBlock, toBlock })
          )
      );
      for (const found of batch) fresh.push(...found);
    }

    const settled = head - REORG_DEPTH;
    if (settled >= from) {
      settledLogs.delete(key);
      if (settledLogs.size >= MAX_CACHED_QUERIES) {
        const oldest = settledLogs.keys().next().value;
        if (oldest !== undefined) settledLogs.delete(oldest);
      }
      settledLogs.set(key, {
        upTo: settled,
        logs: [...(known?.logs ?? []), ...fresh.filter((l) => l.blockNumber <= settled)],
      });
    }
    return [...(known?.logs ?? []), ...fresh];
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
