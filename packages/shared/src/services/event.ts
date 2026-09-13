import { parseEventLogs } from 'viem';
import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';
import { getEventsFromSubgraph, getUserEventsFromSubgraph } from './subgraph';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** EventRegistry ships as the zero address until it's deployed to a chain.
 * Callers use this to fall back instead of reading/writing to 0x0. */
export function isEventRegistryDeployed(): boolean {
  return getContracts().eventRegistry.address.toLowerCase() !== ZERO_ADDRESS;
}

function assertEventRegistryDeployed(): void {
  if (!isEventRegistryDeployed()) {
    throw new Error('Events are not live on this network yet');
  }
}

/** Sentinel sportType value for an event spanning multiple activity types —
 * mirrors GroupRegistry's MULTI_SPORT_TYPE (255) so multi-sport events never
 * collide with a real ACTIVITY_TYPE_MAP value (0-11). */
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
  /** 1e6-fixed-point coordinates (TerritoryRegistry encoding), or 0/0 when
   * the host chose not to pin the event to a place. */
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
  }) as Promise<bigint>;
}

export async function isEventJoined(eventId: bigint, user: `0x${string}`): Promise<boolean> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.eventRegistry,
    functionName: 'isJoined',
    args: [eventId, user],
  }) as Promise<boolean>;
}

export async function getUserEventIds(
  user: `0x${string}`,
  offset = 0n,
  limit = 100n
): Promise<bigint[]> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.eventRegistry,
    functionName: 'getUserEventIds',
    args: [user, offset, limit],
  }) as Promise<bigint[]>;
}

/** Every active event, on-chain scan fallback for chain modes with no
 * subgraph deployed (or if the subgraph request fails). */
async function scanAllEventsFromChain(): Promise<OnchainEvent[]> {
  const count = await getEventCount();
  if (count === 0n) return [];

  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  const events = await Promise.all(ids.map((id) => getEvent(id)));
  return events.filter((e) => e.active);
}

/** All active events, for the community/groups tab. Prefers the deployed
 * subgraph when one exists for the active chain mode; falls back to scanning
 * getEventCount()/getEvent() directly for modes with no subgraph. */
export async function getAllEvents(): Promise<OnchainEvent[]> {
  if (!isEventRegistryDeployed()) return [];
  try {
    const fromSubgraph = await getEventsFromSubgraph();
    if (fromSubgraph) return fromSubgraph;
  } catch (e) {
    console.warn('[Event] Subgraph fetch failed, falling back to on-chain scan:', e);
  }

  try {
    return await scanAllEventsFromChain();
  } catch (e) {
    console.warn('[Event] Failed to scan events from chain:', e);
    return [];
  }
}

/** The events a single wallet currently participates in. Prefers the
 * subgraph when deployed; falls back to getUserEventIds()+getEvent(). */
export async function getUserEvents(user: `0x${string}`): Promise<OnchainEvent[]> {
  if (!isEventRegistryDeployed()) return [];
  try {
    const fromSubgraph = await getUserEventsFromSubgraph(user);
    if (fromSubgraph) return fromSubgraph;
  } catch (e) {
    console.warn('[Event] Subgraph fetch failed, falling back to on-chain scan:', e);
  }

  try {
    const ids = await getUserEventIds(user);
    const events = await Promise.all(ids.map((id) => getEvent(id)));
    return events.filter((e) => e.active);
  } catch (e) {
    console.warn('[Event] Failed to fetch user events from chain:', e);
    return [];
  }
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
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.eventRegistry,
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
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    return { eventId: 0n, confirmed: false };
  }

  const [event] = parseEventLogs({
    abi: contracts.eventRegistry.abi,
    eventName: 'EventCreated',
    logs: receipt.logs,
  });

  const eventId =
    ((event as { args?: Record<string, unknown> })?.args as { eventId?: bigint } | undefined)
      ?.eventId ?? 0n;
  return { eventId, confirmed: true };
}

export async function joinEvent(
  wallet: ReturnType<typeof getWalletClient>,
  eventId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  assertEventRegistryDeployed();
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.eventRegistry,
    functionName: 'joinEvent',
    args: [eventId],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success', txHash: hash };
}

export async function leaveEvent(
  wallet: ReturnType<typeof getWalletClient>,
  eventId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  assertEventRegistryDeployed();
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.eventRegistry,
    functionName: 'leaveEvent',
    args: [eventId],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success', txHash: hash };
}

export async function cancelEvent(
  wallet: ReturnType<typeof getWalletClient>,
  eventId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  assertEventRegistryDeployed();
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.eventRegistry,
    functionName: 'cancelEvent',
    args: [eventId],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success', txHash: hash };
}
