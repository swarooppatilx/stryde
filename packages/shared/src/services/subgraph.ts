import { ACTIVITY_TYPE_BY_ID } from '../constants';
import type { ActivityType } from '../types';
import { getActiveConfig } from './client';
import type { SyncedActivity } from './sync';

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function querySubgraph<T>(url: string, query: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Subgraph request failed: ${response.status}`);
  }

  const body = (await response.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    throw new Error(`Subgraph query error: ${body.errors[0]?.message}`);
  }
  if (!body.data) {
    throw new Error('Subgraph returned no data');
  }
  return body.data;
}

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
}

const ACTIVITIES_QUERY = `{
  activities(first: 1000, orderBy: timestamp, orderDirection: desc) {
    id
    activityId
    user { id }
    activityHash
    activityType
    distance
    duration
    territoryArea
    timestamp
  }
}`;

/** Returns null (rather than throwing) when no subgraph is configured for the
 * active chain mode, so callers can fall back to the getLogs-based sync path
 * without treating "not deployed here" as an error. */
export async function getActivitiesFromSubgraph(): Promise<SyncedActivity[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const data = await querySubgraph<{ activities: ActivityEntity[] }>(subgraphUrl, ACTIVITIES_QUERY);

  return data.activities.map((a) => {
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
    } satisfies SyncedActivity;
  });
}
