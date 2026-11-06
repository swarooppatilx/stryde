import type { AbiEvent, WalletClient } from 'viem';
import { decodeEventLog, keccak256, toBytes, zeroAddress } from 'viem';
import { getActiveConfig, getContracts, getPublicClient } from './client';
import { fetchJsonFromIpfs, uploadJsonToIpfs } from './ipfs';
import { scanLogWindows } from './logScan';
import { getCommentsFromSubgraph, getKudosFromSubgraph } from './subgraph';
import { writeAndConfirm } from './tx';

export interface SyncedKudos {
  activityId: bigint;
  giver: string;
  timestamp: number;
  active: boolean;
}

export interface SyncedComment {
  id: string;
  activityId: bigint;
  author: string;
  cid: string;
  createdAt: number;
  text?: string;
}

export interface CommentDocument {
  version: number;
  type: 'activity_comment';
  activityHash: string;
  commentId: string;
  author: string;
  text: string;
  createdAt: string;
}

export function computeCommentId(
  activityId: bigint,
  author: `0x${string}`,
  text: string,
  timestamp: bigint,
  /** Tells apart two comments with the same text in the same second; without it they were one on-chain comment. Left out, the id is what it always was. */
  nonce = ''
): `0x${string}` {
  const base = `${activityId.toString()}:${author}:${text}:${timestamp.toString()}`;
  return keccak256(toBytes(nonce === '' ? base : `${base}:${nonce}`));
}

export async function uploadCommentToIpfs(
  comment: Omit<CommentDocument, 'version' | 'type'>
): Promise<{ cid: string; size: number }> {
  const doc: CommentDocument = {
    version: 1,
    type: 'activity_comment',
    ...comment,
  };
  return uploadJsonToIpfs(`comment-${Date.now()}`, doc);
}

const KUDO_GIVEN_EVENT = {
  type: 'event',
  name: 'KudosGiven',
  inputs: [
    { type: 'uint256', name: 'activityId', indexed: true },
    { type: 'address', name: 'giver', indexed: true },
    { type: 'uint256', name: 'timestamp', indexed: false },
  ],
} as const;

const KUDO_REVOKED_EVENT = {
  type: 'event',
  name: 'KudosRevoked',
  inputs: [
    { type: 'uint256', name: 'activityId', indexed: true },
    { type: 'address', name: 'giver', indexed: true },
    { type: 'uint256', name: 'timestamp', indexed: false },
  ],
} as const;

const COMMENT_ADDED_EVENT = {
  type: 'event',
  name: 'CommentAdded',
  inputs: [
    { type: 'uint256', name: 'activityId', indexed: true },
    { type: 'address', name: 'author', indexed: true },
    { type: 'bytes32', name: 'commentId', indexed: true },
    { type: 'string', name: 'commentCid', indexed: false },
    { type: 'uint256', name: 'timestamp', indexed: false },
  ],
} as const;

interface CommentMetadata {
  version: number;
  type: string;
  text?: string;
}

async function fetchCommentText(cid: string): Promise<string | null> {
  const doc = await fetchJsonFromIpfs<CommentMetadata>(cid);
  return doc?.text ?? null;
}

const LOOKBACK_BLOCKS = 250_000n;

interface KudosEvent extends SyncedKudos {
  blockNumber: bigint;
  logIndex: number;
}

function decodeKudosLog(
  event: typeof KUDO_GIVEN_EVENT | typeof KUDO_REVOKED_EVENT,
  log: {
    data: `0x${string}`;
    topics: [`0x${string}`, ...`0x${string}`[]] | [];
    blockNumber: bigint | null;
    logIndex: number | null;
  },
  active: boolean
): KudosEvent {
  const { args } = decodeEventLog({ abi: [event], data: log.data, topics: log.topics });
  const a = args;
  return {
    activityId: a.activityId,
    giver: a.giver.toLowerCase(),
    timestamp: Number(a.timestamp),
    active,
    blockNumber: log.blockNumber ?? 0n,
    logIndex: log.logIndex ?? 0,
  };
}

/** Folds gives and revokes in the order they happened onchain; the last event per (activity, giver) wins. */
export function replayKudos(events: KudosEvent[]): SyncedKudos[] {
  const ordered = [...events].sort((x, y) => {
    if (x.blockNumber === y.blockNumber) return x.logIndex - y.logIndex;
    return x.blockNumber < y.blockNumber ? -1 : 1;
  });
  const state = new Map<string, SyncedKudos>();
  for (const { blockNumber: _b, logIndex: _l, ...kudo } of ordered) {
    state.set(`${kudo.activityId}:${kudo.giver}`, kudo);
  }
  return Array.from(state.values()).filter((k) => k.active);
}

async function fetchSocialLogsFromChain(): Promise<{
  kudos: SyncedKudos[];
  comments: SyncedComment[];
}> {
  const client = getPublicClient();
  const contracts = getContracts();
  const socialAddr = contracts.socialRegistry.address;

  if (!socialAddr || socialAddr.toLowerCase() === zeroAddress) {
    return { kudos: [], comments: [] };
  }

  const latest = await client.getBlockNumber();
  // Not before the deployment: the contract does not exist earlier, and public nodes answer
  // "pruned history unavailable" for old ranges, which failed the whole sync.
  const lookbackStart = latest > LOOKBACK_BLOCKS ? latest - LOOKBACK_BLOCKS : 0n;
  const { deployBlock } = getActiveConfig();
  const fromBlock = lookbackStart > deployBlock ? lookbackStart : deployBlock;

  // The lookback is 250k blocks; public Sepolia RPCs refuse spans over 50k, so scan in windows.
  const scan = <E extends AbiEvent>(event: E) =>
    scanLogWindows(
      (start, end) =>
        client.getLogs({ address: socialAddr, event, fromBlock: start, toBlock: end }),
      { fromBlock, latest }
    );
  const [givenLogs, revokedLogs, commentLogs] = await Promise.all([
    scan(KUDO_GIVEN_EVENT),
    scan(KUDO_REVOKED_EVENT),
    scan(COMMENT_ADDED_EVENT),
  ]);

  const kudos = replayKudos([
    ...givenLogs.map((log) => decodeKudosLog(KUDO_GIVEN_EVENT, log, true)),
    ...revokedLogs.map((log) => decodeKudosLog(KUDO_REVOKED_EVENT, log, false)),
  ]);

  // Parse comments
  const comments: SyncedComment[] = [];
  for (const log of commentLogs) {
    const { args } = decodeEventLog({
      abi: [COMMENT_ADDED_EVENT],
      data: log.data,
      topics: log.topics,
    });
    const a = args;
    comments.push({
      id: a.commentId,
      activityId: a.activityId,
      author: a.author.toLowerCase(),
      cid: a.commentCid,
      createdAt: Number(a.timestamp),
    });
  }

  return { kudos, comments };
}

async function hydrateCommentText(comments: SyncedComment[]): Promise<SyncedComment[]> {
  const cids = Array.from(
    new Set(comments.map((c) => c.cid).filter((cid): cid is string => !!cid))
  );
  if (cids.length === 0) return comments;

  const textByCid = new Map<string, string | null>();
  await Promise.all(
    cids.map(async (cid) => {
      textByCid.set(cid, await fetchCommentText(cid));
    })
  );

  return comments.map((c) => {
    const text = textByCid.get(c.cid) ?? undefined;
    return text ? { ...c, text } : c;
  });
}

export interface SocialSyncResult {
  kudos: SyncedKudos[];
  comments: SyncedComment[];
}

export async function syncSocialFromChain(): Promise<SocialSyncResult> {
  try {
    const subgraphKudos = await getKudosFromSubgraph();
    const subgraphComments = await getCommentsFromSubgraph();

    if (subgraphKudos !== null && subgraphComments !== null) {
      const hydratedComments = await hydrateCommentText(
        subgraphComments.map((c) => ({
          id: c.id,
          activityId: c.activityId,
          author: c.author,
          cid: c.cid,
          createdAt: c.createdAt,
        }))
      );
      return { kudos: subgraphKudos, comments: hydratedComments };
    }
  } catch {
    // fall through to on-chain scan
  }

  // Fallback: scan logs directly
  const { kudos, comments } = await fetchSocialLogsFromChain();
  const hydratedComments = await hydrateCommentText(comments);
  return { kudos, comments: hydratedComments };
}

export async function toggleKudos(
  wallet: WalletClient,
  activityId: bigint
): Promise<{ txHash: `0x${string}`; confirmed: boolean; gave: boolean }> {
  const account = wallet.account;
  if (!account) throw new Error('No wallet account found');

  const hadKudos = await getPublicClient().readContract({
    ...getContracts().socialRegistry,
    functionName: 'hasKudos',
    args: [activityId, account.address],
  });
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'socialRegistry', {
    functionName: 'toggleKudos',
    args: [activityId],
  });
  return { txHash, confirmed, gave: !hadKudos };
}

/**
 * Makes sure the wallet's kudos on an activity is (or is not) there. Unlike `toggleKudos` it is
 * safe to repeat: when the chain already matches, nothing is sent.
 */
export async function setKudos(
  wallet: WalletClient,
  activityId: bigint,
  wanted: boolean
): Promise<{ changed: false } | { changed: true; txHash: `0x${string}`; confirmed: boolean }> {
  const account = wallet.account;
  if (!account) throw new Error('No wallet account found');

  const has = await getPublicClient().readContract({
    ...getContracts().socialRegistry,
    functionName: 'hasKudos',
    args: [activityId, account.address],
  });
  if (has === wanted) return { changed: false };

  const { txHash, confirmed } = await writeAndConfirm(wallet, 'socialRegistry', {
    functionName: 'toggleKudos',
    args: [activityId],
  });
  return { changed: true, txHash, confirmed };
}

export async function addComment(
  wallet: WalletClient,
  activityId: bigint,
  commentId: `0x${string}`,
  cid: string
): Promise<{ txHash: `0x${string}`; confirmed: boolean }> {
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'socialRegistry', {
    functionName: 'addComment',
    args: [activityId, commentId, cid],
  });
  return { txHash, confirmed };
}
