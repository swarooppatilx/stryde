import { getIpfsConfig } from './ipfs';

export interface RelayResult {
  hash?: `0x${string}`;
  confirmed: boolean;
  /** True when the request was parked on the offline queue instead of sent. */
  queued?: boolean;
}

/**
 * Minimal async key/value persistence used by the offline queue. Conforms to
 * the shape of AsyncStorage (via the mobile app's asyncStorageAdapter), so the
 * mobile app injects real on-device persistence while API/web tests run with
 * an in-memory store.
 */
export interface RelayQueueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface RelayQueueEntry {
  id: string;
  path: string;
  body: Record<string, unknown>;
  attempts: number;
  createdAt: number;
}

interface RelayQueueState {
  entries: RelayQueueEntry[];
}

const QUEUE_KEY = '@stryde/relay-queue';

let queueStorage: RelayQueueStorage | null = null;
let isOnline: () => boolean = () => true;
/** Serialize access so concurrent drains don't double-send an entry. */
let drainLock: Promise<{ replayed: number; failed: number }> | null = null;

export function setRelayQueueStorage(storage: RelayQueueStorage): void {
  queueStorage = storage;
}

export function setRelayQueueConnectivity(online: () => boolean): void {
  isOnline = online;
}

export function isRelayQueueEnabled(): boolean {
  return queueStorage !== null;
}

async function readQueue(): Promise<RelayQueueState> {
  if (!queueStorage) {
    throw new Error('Relay queue not configured — call setRelayQueueStorage() first');
  }
  const raw = await queueStorage.getItem(QUEUE_KEY);
  if (!raw) return { entries: [] };
  try {
    return JSON.parse(raw) as RelayQueueState;
  } catch {
    return { entries: [] };
  }
}

async function writeQueue(state: RelayQueueState): Promise<void> {
  if (!queueStorage) return;
  await queueStorage.setItem(QUEUE_KEY, JSON.stringify(state));
}

function isNetworkError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as Error;
  const message = err.message ?? '';
  return (
    message === 'Network request failed' ||
    message.includes('fetch failed') ||
    message.includes('Failed to fetch') ||
    message.includes('ENOTFOUND') ||
    message.includes('ECONNREFUSED') ||
    message.includes('Timeout') ||
    message.includes('timed out')
  );
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Raw relay POST — no queue involvement. Throws on any non-2xx/network error. */
async function relayPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const config = getIpfsConfig();
  if (!config) {
    throw new Error('Relay not configured — call setIpfsConfig() first');
  }

  const response = await fetch(`${config.apiUrl}/api/relay/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Relay request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function send(path: string, body: Record<string, unknown>): Promise<RelayResult> {
  try {
    const result = await relayPost<RelayResult>(path, body);
    return { confirmed: result.confirmed, hash: result.hash };
  } catch (error) {
    if (queueStorage && isNetworkError(error)) {
      await enqueueRelayRequest(path, body);
      return { confirmed: false, queued: true };
    }
    throw error;
  }
}

export async function enqueueRelayRequest(
  path: string,
  body: Record<string, unknown>
): Promise<void> {
  if (!queueStorage) return;
  const state = await readQueue();
  const dup = state.entries.find(
    (e) => e.path === path && JSON.stringify(e.body) === JSON.stringify(body)
  );
  if (dup) return;
  state.entries.push({
    id: makeId(),
    path,
    body,
    attempts: 0,
    createdAt: Date.now(),
  });
  await writeQueue(state);
}

export async function getRelayQueueSize(): Promise<number> {
  if (!queueStorage) return 0;
  const state = await readQueue();
  return state.entries.length;
}

export async function clearRelayQueue(): Promise<void> {
  if (!queueStorage) return;
  await writeQueue({ entries: [] });
}

const MAX_BACKOFF_MS = 60_000;

function backoffFor(attempts: number): number {
  const delay = Math.min(5000 * 2 ** attempts, MAX_BACKOFF_MS);
  return delay;
}

type AsyncRetryFn = (path: string, body: Record<string, unknown>) => Promise<RelayResult>;

/**
 * Replays every queued relay write that isn't currently reachable. Retrying
 * the whole queue top-to-bottom keeps mints order-consistent and self-healing:
 * a mint that fails (e.g. transient chain outage) fails to the back of the
 * queue its time budget rather than wedging the entries behind it.
 */
export async function drainRelayQueue(): Promise<{ replayed: number; failed: number }> {
  if (!queueStorage) return { replayed: 0, failed: 0 };

  if (drainLock) return drainLock;
  drainLock = runDrain();

  try {
    return await drainLock;
  } finally {
    drainLock = null;
  }
}

async function runDrain(
  sendFn: AsyncRetryFn = (path, body) => send(path, body)
): Promise<{ replayed: number; failed: number }> {
  let state = await readQueue();
  if (state.entries.length === 0) return { replayed: 0, failed: 0 };

  const remaining: RelayQueueEntry[] = [];
  let replayed = 0;
  let failed = 0;

  for (const entry of state.entries) {
    if (!isOnline()) {
      remaining.push(entry);
      continue;
    }
    try {
      const result = await sendFn(entry.path, entry.body);
      if (result.queued) {
        remaining.push(entry);
      } else {
        replayed++;
      }
    } catch {
      entry.attempts += 1;
      entry.createdAt = Date.now() + backoffFor(entry.attempts);
      remaining.push(entry);
      failed++;
    }
  }

  state = { entries: remaining };
  await writeQueue(state);
  return { replayed, failed };
}

export function relayMintAchievement(
  recipient: `0x${string}`,
  achievementId: `0x${string}`,
  achievementName: string
): Promise<RelayResult> {
  return send('mint-achievement', {
    recipient,
    achievementId,
    achievementName,
  });
}

export function relayMintReward(
  recipient: `0x${string}`,
  activityHash: `0x${string}`,
  distance: number
): Promise<RelayResult> {
  return send('mint-reward', {
    recipient,
    activityHash,
    distance,
  });
}

export function relayMintTerritoryNFT(
  recipient: `0x${string}`,
  polygonHash: `0x${string}`
): Promise<RelayResult> {
  return send('mint-territory-nft', {
    recipient,
    polygonHash,
  });
}

export function relayStartSeason(durationSeconds: number): Promise<RelayResult> {
  return send('start-season', { durationSeconds });
}
