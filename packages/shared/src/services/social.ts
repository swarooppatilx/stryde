import type { WalletClient } from 'viem';
import { decodeEventLog, keccak256, toBytes } from 'viem';
import { getActiveConfig, getContracts, getPublicClient } from './client';
import { fetchJsonFromIpfs, uploadJsonToIpfs } from './ipfs';
import { getCommentsFromSubgraph, getKudosFromSubgraph } from './subgraph';

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
  timestamp: bigint
): `0x${string}` {
  return keccak256(toBytes(`${activityId.toString()}:${author}:${text}:${timestamp.toString()}`));
}

export async function uploadCommentToIpfs(
  comment: Omit<CommentDocument, 'version' | 'type'>
): Promise<{ cid: string; size: number }> {
  const doc: CommentDocument = {
    version: 1,
    type: 'activity_comment',
    ...comment,
  };
  return uploadJsonToIpfs(`comment-${Date.now()}`, doc as unknown as Record<string, unknown>);
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
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

async function fetchSocialLogsFromChain(): Promise<{
  kudos: SyncedKudos[];
  comments: SyncedComment[];
}> {
  const client = getPublicClient();
  const contracts = getContracts();
  const socialAddr = contracts.socialRegistry.address;

  if (!socialAddr || socialAddr.toLowerCase() === ZERO_ADDRESS) {
    return { kudos: [], comments: [] };
  }

  const latest = await client.getBlockNumber();
  const fromBlock = latest > LOOKBACK_BLOCKS ? latest - LOOKBACK_BLOCKS : 0n;

  const [givenLogs, revokedLogs, commentLogs] = await Promise.all([
    client.getLogs({
      address: socialAddr,
      event: KUDO_GIVEN_EVENT,
      fromBlock,
      toBlock: 'latest',
    }),
    client.getLogs({
      address: socialAddr,
      event: KUDO_REVOKED_EVENT,
      fromBlock,
      toBlock: 'latest',
    }),
    client.getLogs({
      address: socialAddr,
      event: COMMENT_ADDED_EVENT,
      fromBlock,
      toBlock: 'latest',
    }),
  ]);

  // Rebuild kudos state: track give/revoke per (activityId, giver)
  const kudosState = new Map<string, SyncedKudos>();

  for (const log of givenLogs) {
    const { args } = decodeEventLog({
      abi: [KUDO_GIVEN_EVENT],
      data: log.data,
      topics: log.topics,
    });
    const a = args as unknown as { activityId: bigint; giver: `0x${string}`; timestamp: bigint };
    const key = `${a.activityId}:${a.giver.toLowerCase()}`;
    kudosState.set(key, {
      activityId: a.activityId,
      giver: a.giver.toLowerCase(),
      timestamp: Number(a.timestamp),
      active: true,
    });
  }

  for (const log of revokedLogs) {
    const { args } = decodeEventLog({
      abi: [KUDO_REVOKED_EVENT],
      data: log.data,
      topics: log.topics,
    });
    const a = args as unknown as { activityId: bigint; giver: `0x${string}`; timestamp: bigint };
    const key = `${a.activityId}:${a.giver.toLowerCase()}`;
    kudosState.set(key, {
      activityId: a.activityId,
      giver: a.giver.toLowerCase(),
      timestamp: Number(a.timestamp),
      active: false,
    });
  }

  const kudos = Array.from(kudosState.values()).filter((k) => k.active);

  // Parse comments
  const comments: SyncedComment[] = [];
  for (const log of commentLogs) {
    const { args } = decodeEventLog({
      abi: [COMMENT_ADDED_EVENT],
      data: log.data,
      topics: log.topics,
    });
    const a = args as unknown as {
      activityId: bigint;
      author: `0x${string}`;
      commentId: `0x${string}`;
      commentCid: string;
      timestamp: bigint;
    };
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
  const contracts = getContracts();
  const config = getActiveConfig();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  // Check current state
  const current = await getPublicClient().readContract({
    ...contracts.socialRegistry,
    functionName: 'hasKudos',
    args: [activityId, account],
  });

  const hash = await wallet.writeContract({
    ...contracts.socialRegistry,
    functionName: 'toggleKudos',
    args: [activityId],
    account,
    chain: config.chain,
  });

  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  return { txHash: hash, confirmed: receipt.status === 'success', gave: !current };
}

export async function addComment(
  wallet: WalletClient,
  activityId: bigint,
  commentId: `0x${string}`,
  cid: string
): Promise<{ txHash: `0x${string}`; confirmed: boolean }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.socialRegistry,
    functionName: 'addComment',
    args: [activityId, commentId, cid],
    account,
    chain: config.chain,
  });

  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  return { txHash: hash, confirmed: receipt.status === 'success' };
}
