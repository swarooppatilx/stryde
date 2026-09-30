import { parseAbiItem } from 'viem';
import { isAddress } from './address.js';

const ACTIVITY_RECORDED = parseAbiItem(
  'event ActivityRecorded(uint256 indexed activityId, address indexed owner, bytes32 indexed activityHash, uint8 activityType, uint256 distance, uint256 duration, uint256 timestamp, uint256 territoryArea)'
);

/** Public Sepolia RPCs reject eth_getLogs spans wider than 50,000 blocks. */
export const LOG_WINDOW_BLOCKS = 50_000n;

interface LogReader {
  getBlockNumber(options?: { cacheTime: number }): Promise<bigint>;
  getLogs(params: {
    address: `0x${string}`;
    event: typeof ACTIVITY_RECORDED;
    args: { activityHash: `0x${string}` };
    fromBlock: bigint;
    toBlock: bigint;
    strict: true;
  }): Promise<Array<{ args: { owner?: `0x${string}`; distance?: bigint } }>>;
}

/**
 * The onchain record behind an activity hash: who recorded it and the distance they recorded.
 * Rewards are requested right after recording, so the newest blocks are searched first.
 */
export async function findRecordedActivity(
  client: LogReader,
  activityRegistry: `0x${string}`,
  activityHash: `0x${string}`,
  deployBlock: bigint
): Promise<{ owner: `0x${string}`; distance: bigint } | null> {
  // Fresh, not viem's cached head (about four seconds old): the activity was recorded moments ago and the
  // cached head can sit before its block.
  let toBlock = await client.getBlockNumber({ cacheTime: 0 });
  while (toBlock >= deployBlock) {
    const windowStart = toBlock - LOG_WINDOW_BLOCKS + 1n;
    const fromBlock = windowStart > deployBlock ? windowStart : deployBlock;
    const logs = await client.getLogs({
      address: activityRegistry,
      event: ACTIVITY_RECORDED,
      args: { activityHash },
      fromBlock,
      toBlock,
      strict: true,
    });
    const recorded = logs[0]?.args;
    if (recorded?.owner && recorded.distance !== undefined) {
      return { owner: recorded.owner, distance: recorded.distance };
    }
    toBlock = fromBlock - 1n;
  }
  return null;
}

const ACTIVITY_BY_HASH = `query ActivityByHash($hash: Bytes!) {
  activities(first: 1, where: { activityHash: $hash }) { user { id } distance }
}`;

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<Response>;

/** The same record, from the indexer: one query instead of scanning block ranges. */
export async function findRecordedActivityInSubgraph(
  subgraphUrl: string,
  activityHash: `0x${string}`,
  fetchFn: FetchLike = fetch
): Promise<{ owner: `0x${string}`; distance: bigint } | null> {
  const response = await fetchFn(subgraphUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: ACTIVITY_BY_HASH,
      variables: { hash: activityHash.toLowerCase() },
    }),
  });
  if (!response.ok) throw new Error(`Subgraph request failed: ${response.status}`);
  const body: unknown = await response.json();
  const { data, errors } = (typeof body === 'object' && body !== null ? body : {}) as {
    data?: { activities?: Array<{ user?: { id?: unknown }; distance?: unknown }> };
    errors?: Array<{ message?: string }>;
  };
  if (errors?.length) throw new Error(`Subgraph query error: ${errors[0]?.message}`);
  const hit = data?.activities?.[0];
  const owner = hit?.user?.id;
  const distance = hit?.distance;
  if (!isAddress(owner) || typeof distance !== 'string') {
    return null;
  }
  return { owner: owner as `0x${string}`, distance: BigInt(distance) };
}
