import { zeroAddress } from 'viem';
import { getActiveConfig } from './client';
import type { OnchainEvent } from './event';
import { querySubgraph } from './subgraphClient';
import { paginate } from './subgraphPaginate';

interface EventEntity {
  id: string;
  host: { id: string } | null;
  title: string;
  description: string;
  sportType: number;
  startTime: string;
  endTime: string;
  distanceGoal: string;
  startLat: number;
  startLng: number;
  participantCount: string;
  createdAt: string;
  active: boolean;
}

function mapEventEntity(e: EventEntity): OnchainEvent {
  return {
    id: BigInt(e.id),
    host: (e.host?.id ?? zeroAddress) as `0x${string}`,
    title: e.title,
    description: e.description,
    sportType: e.sportType,
    startTime: Number(e.startTime),
    endTime: Number(e.endTime),
    distanceGoal: Number(e.distanceGoal),
    startLat: e.startLat,
    startLng: e.startLng,
    participantCount: Number(e.participantCount),
    createdAt: Number(e.createdAt),
    active: e.active,
  };
}

/** Every active event, for the community/groups tab. Returns null (rather
 * than throwing) when no subgraph is configured for the active chain mode or
 * when events aren't indexed yet (EventRegistry not deployed), so callers can
 * fall back to the on-chain getEventCount()+getEvent() scan. */
export async function getEventsFromSubgraph(): Promise<OnchainEvent[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const allEvents = await paginate<EventEntity>({
    url: subgraphUrl,
    collection: 'events',
    idType: 'String',
    selection:
      'id host { id } title description sportType startTime endTime distanceGoal startLat startLng participantCount createdAt active',
    where: 'active: true',
  });
  allEvents.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

  return allEvents.map(mapEventEntity);
}

const USER_EVENTS_QUERY = `
  query GetUserEvents($wallet: String!) {
    eventParticipants(first: 1000, where: { user_: { id: $wallet }, active: true }) {
      event {
        id
        host { id }
        title
        description
        sportType
        startTime
        endTime
        distanceGoal
        startLat
        startLng
        participantCount
        createdAt
        active
      }
    }
  }
`;

/** The events a single wallet currently participates in. Returns null (rather
 * than throwing) when no subgraph is configured or events aren't indexed. */
export async function getUserEventsFromSubgraph(
  wallet: `0x${string}`
): Promise<OnchainEvent[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const data = await querySubgraph<{
    eventParticipants: { event: EventEntity }[];
  }>(subgraphUrl, USER_EVENTS_QUERY, { wallet: wallet.toLowerCase() });
  const eventParticipants = data.eventParticipants;
  return eventParticipants.filter((ep) => ep.event.active).map((ep) => mapEventEntity(ep.event));
}
