import { getActiveConfig } from './client';
import { paginate } from './subgraphPaginate';

interface KudosEntity {
  id: string;
  activity: { id: string; activityId: string };
  giver: { id: string };
  givenAt: string;
  active: boolean;
}

interface CommentEntity {
  id: string;
  activity: { id: string; activityId: string };
  author: { id: string };
  cid: string;
  createdAt: string;
}

export interface SubgraphKudos {
  activityId: bigint;
  giver: string;
  timestamp: number;
  active: boolean;
}

export interface SubgraphComment {
  id: string;
  activityId: bigint;
  author: string;
  cid: string;
  createdAt: number;
}

/** Null when no subgraph is configured, so callers fall back to the getLogs scan. */
export async function getKudosFromSubgraph(): Promise<SubgraphKudos[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const allKudos = await paginate<KudosEntity>({
    url: subgraphUrl,
    collection: 'activityKudos_collection',
    idType: 'Bytes',
    selection: 'id activity { id activityId } giver { id } givenAt active',
    where: 'active: true',
  });
  allKudos.sort((a, b) => Number(b.givenAt) - Number(a.givenAt));

  return allKudos.map((k) => ({
    activityId: BigInt(k.activity.activityId),
    giver: k.giver.id.toLowerCase(),
    timestamp: Number(k.givenAt),
    active: k.active,
  }));
}

/** Null when no subgraph is configured, so callers fall back to the getLogs scan. */
export async function getCommentsFromSubgraph(): Promise<SubgraphComment[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const allComments = await paginate<CommentEntity>({
    url: subgraphUrl,
    collection: 'activityComments',
    idType: 'Bytes',
    selection: 'id activity { id activityId } author { id } cid createdAt',
  });
  allComments.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

  return allComments.map((c) => ({
    id: c.id,
    activityId: BigInt(c.activity.activityId),
    author: c.author.id.toLowerCase(),
    cid: c.cid,
    createdAt: Number(c.createdAt),
  }));
}
