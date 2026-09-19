import { parseEventLogs, zeroAddress } from 'viem';
import { getContracts, getPublicClient, type getWalletClient } from './client';
import { getEventsFromSubgraph, getUserEventsFromSubgraph } from './subgraph';
import { writeAndConfirm } from './tx';

/** EventRegistry is the zero address until deployed; callers use this to fall back instead of calling 0x0. */
export function isEventRegistryDeployed(): boolean {
  return getContracts().eventRegistry.address.toLowerCase() !== zeroAddress;
}

function assertEventRegistryDeployed(): void {
  if (!isEventRegistryDeployed()) {
    throw new Error('Events are not live on this network yet');
  }
}

/** Sentinel `sportType` for multi-sport events; mirrors GroupRegistry's MULTI_SPORT_TYPE (255) so it never collides with ACTIVITY_TYPE_MAP (0-11). */
export const MULTI_SPORT_TYPE = 255;

export interface OnchainEvent {
  id: bigint;
  host: `0x${string}`;
  title: string;
  description: string;
  sportType: number;
  startTime: number;
  endTime: number;
  distanceGoal: number;
  /** 1e6-fixed-point coordinates (TerritoryRegistry encoding), or 0/0 when the event has no place. */
  startLat: number;
  startLng: number;
  participantCount: number;
  createdAt: number;
  active: boolean;
}

interface RawEvent {
  host: `0x${string}`;
  title: string;
  description: string;
  sportType: number;
  startTime: bigint;
  endTime: bigint;
  distanceGoal: bigint;
  startLat: number;
  startLng: number;
  participantCount: bigint;
  createdAt: bigint;
  active: boolean;
}

function toOnchainEvent(eventId: bigint, raw: RawEvent): OnchainEvent {
  return {
    id: eventId,
    host: raw.host,
    title: raw.title,
    description: raw.description,
    sportType: raw.sportType,
    startTime: Number(raw.startTime),
    endTime: Number(raw.endTime),
    distanceGoal: Number(raw.distanceGoal),
    startLat: Number(raw.startLat),
    startLng: Number(raw.startLng),
    participantCount: Number(raw.participantCount),
    createdAt: Number(raw.createdAt),
    active: raw.active,
  };
}

export async function getEvent(eventId: bigint): Promise<OnchainEvent> {
  const client = getPublicClient();
  const contracts = getContracts();
  const raw = (await client.readContract({
    ...contracts.eventRegistry,
    functionName: 'getEvent',
    args: [eventId],
  })) as RawEvent;

  return toOnchainEvent(eventId, raw);
}

export async function getEventCount(): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.eventRegistry,
    functionName: 'getEventCount',
  });
}

export async function isEventJoined(eventId: bigint, user: `0x${string}`): Promise<boolean> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.eventRegistry,
    functionName: 'isJoined',
    args: [eventId, user],
  });
}

export async function getUserEventIds(
  user: `0x${string}`,
  offset = 0n,
  limit = 100n
): Promise<readonly bigint[]> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.eventRegistry,
    functionName: 'getUserEventIds',
    args: [user, offset, limit],
  });
}

/** Every active event via on-chain scan; fallback when no subgraph is deployed or its request fails. */
async function scanAllEventsFromChain(): Promise<OnchainEvent[]> {
  const count = await getEventCount();
  if (count === 0n) return [];

  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  const events = await Promise.all(ids.map((id) => getEvent(id)));
  return events.filter((e) => e.active);
}

/** All active events; uses the subgraph when available, else scans getEventCount()/getEvent(). */
export async function getAllEvents(): Promise<OnchainEvent[]> {
  if (!isEventRegistryDeployed()) return [];
  try {
    const fromSubgraph = await getEventsFromSubgraph();
    if (fromSubgraph) return fromSubgraph;
  } catch (e) {
    console.warn('[Event] Subgraph fetch failed, falling back to on-chain scan:', e);
  }

  // No catch: an empty list means "there are none", not "couldn't read".
  return scanAllEventsFromChain();
}

/** The events a wallet participates in; subgraph first, else getUserEventIds()+getEvent(). */
export async function getUserEvents(user: `0x${string}`): Promise<OnchainEvent[]> {
  if (!isEventRegistryDeployed()) return [];
  try {
    const fromSubgraph = await getUserEventsFromSubgraph(user);
    if (fromSubgraph) return fromSubgraph;
  } catch (e) {
    console.warn('[Event] Subgraph fetch failed, falling back to on-chain scan:', e);
  }

  const ids = await getUserEventIds(user);
  const events = await Promise.all(ids.map((id) => getEvent(id)));
  return events.filter((e) => e.active);
}

export async function createEvent(
  wallet: ReturnType<typeof getWalletClient>,
  params: {
    title: string;
    description: string;
    sportType: number;
    startTime: number;
    endTime: number;
    distanceGoal: number;
    startLat?: number;
    startLng?: number;
  }
): Promise<{ eventId: bigint; confirmed: boolean }> {
  assertEventRegistryDeployed();
  const contracts = getContracts();

  const { confirmed, receipt } = await writeAndConfirm(wallet, 'eventRegistry', {
    functionName: 'createEvent',
    args: [
      params.title,
      params.description,
      params.sportType,
      BigInt(params.startTime),
      BigInt(params.endTime),
      BigInt(Math.round(params.distanceGoal)),
      params.startLat ?? 0,
      params.startLng ?? 0,
    ],
  });
  if (!confirmed) {
    return { eventId: 0n, confirmed: false };
  }

  const [event] = parseEventLogs({
    abi: contracts.eventRegistry.abi,
    eventName: 'EventCreated',
    logs: receipt.logs,
  });

  const eventId = event?.args.eventId ?? 0n;
  return { eventId, confirmed: true };
}

export async function joinEvent(
  wallet: ReturnType<typeof getWalletClient>,
  eventId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  assertEventRegistryDeployed();

  const { txHash, confirmed } = await writeAndConfirm(wallet, 'eventRegistry', {
    functionName: 'joinEvent',
    args: [eventId],
  });
  return { confirmed, txHash };
}

export async function leaveEvent(
  wallet: ReturnType<typeof getWalletClient>,
  eventId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  assertEventRegistryDeployed();

  const { txHash, confirmed } = await writeAndConfirm(wallet, 'eventRegistry', {
    functionName: 'leaveEvent',
    args: [eventId],
  });
  return { confirmed, txHash };
}

export async function cancelEvent(
  wallet: ReturnType<typeof getWalletClient>,
  eventId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  assertEventRegistryDeployed();

  const { txHash, confirmed } = await writeAndConfirm(wallet, 'eventRegistry', {
    functionName: 'cancelEvent',
    args: [eventId],
  });
  return { confirmed, txHash };
}
