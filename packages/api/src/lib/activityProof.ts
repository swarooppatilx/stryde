import { parseAbiItem } from 'viem';
import { isAddress } from './address.js';

const ACTIVITY_RECORDED = parseAbiItem(
  'event ActivityRecorded(uint256 indexed activityId, address indexed owner, bytes32 indexed activityHash, uint8 activityType, uint256 distance, uint256 duration, uint256 timestamp, uint256 territoryArea)'
);

/** Public Sepolia RPCs reject eth_getLogs spans wider than 50,000 blocks. */
export const LOG_WINDOW_BLOCKS = 50_000n;
/** Tries at a window that a lagging RPC node says is past its head, and the wait between them. */
const HEAD_LAG_ATTEMPTS = 4;
const HEAD_LAG_DELAY_MS = 1000;

/**
 * A load-balanced RPC can report a head on one node and serve getLogs from another a block behind,
 * which rejects the window as past its head. viem does not retry that, so it would fail the request.
 */
function isPastHead(error: unknown): boolean {
  const e = error as { message?: unknown; details?: unknown } | null;
  return /beyond current head/i.test(`${e?.details ?? ''} ${e?.message ?? ''}`);
}

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
  deployBlock: bigint,
  { headLagDelayMs = HEAD_LAG_DELAY_MS }: { headLagDelayMs?: number } = {}
): Promise<{ owner: `0x${string}`; distance: bigint } | null> {
  // Waits for a lagging node instead of reading only to its head: that could miss the run just recorded.
  async function getLogsToHead(args: Parameters<LogReader['getLogs']>[0]) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await client.getLogs(args);
      } catch (error) {
        if (attempt >= HEAD_LAG_ATTEMPTS || !isPastHead(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, headLagDelayMs));
      }
    }
  }

  // Fresh, not viem's cached head (about four seconds old): the activity was recorded moments ago and the
  // cached head can sit before its block.
  let toBlock = await client.getBlockNumber({ cacheTime: 0 });
  while (toBlock >= deployBlock) {
    const windowStart = toBlock - LOG_WINDOW_BLOCKS + 1n;
    const fromBlock = windowStart > deployBlock ? windowStart : deployBlock;
    const logs = await getLogsToHead({
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
