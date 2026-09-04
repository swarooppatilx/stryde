import { Client, gql, type OperationResult } from '@urql/core';
import { ENV } from '@/constants/config';

const client = new Client({
  url: ENV.SUBGRAPH_URL || 'https://api.studio.thegraph.com/query/0/stryde-sepolia/version/latest',
});

const PROFILE_QUERY = gql`
  query GetProfile($id: Bytes!) {
    profile(id: $id) {
      id
      username
      profileId
      createdAt
      contributions {
        id
        distance
        recordedAt
      }
    }
  }
`;

const USER_ACTIVITIES_QUERY = gql`
  query GetUserActivities($userId: Bytes!, $first: Int!, $skip: Int!) {
    activities(
      where: { user: $userId }
      orderBy: timestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      activityHash
      activityType
      distance
      duration
      territoryArea
      timestamp
      blockNumber
    }
  }
`;

const USER_TERRITORIES_QUERY = gql`
  query GetUserTerritories($owner: Bytes!) {
    territories(where: { owner: $owner }) {
      id
      area
      strength
      capturedAt
      lastReinforced
    }
  }
`;

export interface SubgraphProfile {
  id: string;
  username: string;
  profileId: string;
  createdAt: string;
}

export interface SubgraphActivity {
  id: string;
  activityHash: string;
  activityType: number;
  distance: string;
  duration: string;
  territoryArea: string;
  timestamp: string;
  blockNumber: string;
}

export interface SubgraphTerritory {
  id: string;
  area: string;
  strength: string;
  capturedAt: string;
  lastReinforced: string;
}

export async function getProfile(walletAddress: string): Promise<SubgraphProfile | null> {
  const result: OperationResult<{ profile: SubgraphProfile | null }> = await client
    .query(PROFILE_QUERY, { id: walletAddress.toLowerCase() })
    .toPromise();
  return result.data?.profile ?? null;
}

export async function getUserActivities(
  walletAddress: string,
  first = 20,
  skip = 0
): Promise<SubgraphActivity[]> {
  const result: OperationResult<{ activities: SubgraphActivity[] }> = await client
    .query(USER_ACTIVITIES_QUERY, {
      userId: walletAddress.toLowerCase(),
      first,
      skip,
    })
    .toPromise();
  return result.data?.activities ?? [];
}

export async function getUserTerritories(walletAddress: string): Promise<SubgraphTerritory[]> {
  const result: OperationResult<{ territories: SubgraphTerritory[] }> = await client
    .query(USER_TERRITORIES_QUERY, { owner: walletAddress.toLowerCase() })
    .toPromise();
  return result.data?.territories ?? [];
}

export { client as subgraphClient };
