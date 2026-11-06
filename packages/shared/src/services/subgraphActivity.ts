import { ACTIVITY_TYPE_BY_ID } from '../constants';
import type { ActivityType } from '../types';
import { getActiveConfig } from './client';
import { HEX_ADDRESS_RE } from './subgraphClient';
import { paginate } from './subgraphPaginate';
import type { SyncedActivity } from './sync';

const HEX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

interface ActivityEntity {
  id: string;
  activityId: string;
  user: { id: string };
  activityHash: string;
  activityType: number;
  distance: string;
  duration: string;
  territoryArea: string;
  timestamp: string;
  metadataCid: string | null;
}

/** Null when no subgraph is configured, so callers fall back to the getLogs sync path. Pass `wallet` to filter to one participant and `activityHash` to narrow to one activity. */
export async function getActivitiesFromSubgraph(
  wallet?: `0x${string}`,
  activityHash?: string
): Promise<SyncedActivity[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;
  if (wallet && !HEX_ADDRESS_RE.test(wallet)) {
    throw new Error(`Invalid wallet address for subgraph query: ${wallet}`);
  }
  if (activityHash && !HEX_HASH_RE.test(activityHash)) {
    throw new Error(`Invalid activity hash for subgraph query: ${activityHash}`);
  }
  const filters = [
    wallet ? `user_: { id: "${wallet.toLowerCase()}" }` : '',
    activityHash ? `activityHash: "${activityHash.toLowerCase()}"` : '',
  ].filter(Boolean);

  const allActivities = await paginate<ActivityEntity>({
    url: subgraphUrl,
    collection: 'activities',
    idType: 'Bytes',
    selection:
      'id activityId user { id } activityHash activityType distance duration territoryArea timestamp metadataCid',
    where: filters.length > 0 ? filters.join(', ') : undefined,
  });
  allActivities.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

  return allActivities.map((a) => {
    const activityType: ActivityType = ACTIVITY_TYPE_BY_ID[a.activityType] ?? 'run';
    return {
      activityHash: a.activityHash,
      owner: a.user.id,
      activityId: BigInt(a.activityId),
      activityType,
      distance: Number(a.distance),
      duration: Number(a.duration),
      territoryArea: Number(a.territoryArea),
      timestamp: Number(a.timestamp),
      metadata: '',
      metadataCid: a.metadataCid ?? undefined,
    } satisfies SyncedActivity;
  });
}

/**
 * Activities by any of these wallets since `sinceSeconds`, newest first: what a club leaderboard
 * needs. Null when no subgraph is configured.
 */
export async function getRecentActivitiesForUsersFromSubgraph(
  wallets: readonly `0x${string}`[],
  sinceSeconds: number
): Promise<SyncedActivity[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;
  const valid = wallets.filter((w) => HEX_ADDRESS_RE.test(w)).map((w) => `"${w.toLowerCase()}"`);
  if (valid.length === 0) return [];
  const found = await paginate<ActivityEntity>({
    url: subgraphUrl,
    collection: 'activities',
    idType: 'Bytes',
    selection:
      'id activityId user { id } activityHash activityType distance duration territoryArea timestamp metadataCid',
    where: `user_in: [${valid.join(', ')}], timestamp_gte: "${Math.floor(sinceSeconds)}"`,
  });
  return found
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
    .map((a) => ({
      activityHash: a.activityHash,
      owner: a.user.id,
      activityId: BigInt(a.activityId),
      activityType: ACTIVITY_TYPE_BY_ID[a.activityType] ?? 'run',
      distance: Number(a.distance),
      duration: Number(a.duration),
      territoryArea: Number(a.territoryArea),
      timestamp: Number(a.timestamp),
      metadata: '',
      metadataCid: a.metadataCid ?? undefined,
    }));
}
