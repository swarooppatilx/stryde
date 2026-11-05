import { getIpfsConfig } from './ipfs';

export interface RelayResult {
  hash?: `0x${string}`;
  confirmed: boolean;
  /** True when the request was parked on the offline queue instead of sent. */
  queued?: boolean;
}

/** Minimal async key/value persistence for the offline queue; shaped like AsyncStorage so the app injects real persistence while API/web tests use an in-memory store. */
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
  /** Don't retry before this time (set after a failed replay). */
  notBefore?: number;
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

/** The relayer answered, but with a refusal. */
class RelayHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The relayer's machine-readable reason, e.g. a World ID check a held reward waits for. */
    readonly code?: string
  ) {
    super(message);
  }
}

/** Answers that will not change on retry: the request itself is wrong or not allowed. */
const PERMANENT_STATUSES = new Set([400, 403, 404, 409, 422]);
const MAX_REPLAY_ATTEMPTS = 8;
/** Aborts a hung request so it becomes an error isNetworkError() recognises and is queued for retry instead of silently lost. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Raw relay POST — no queue involvement. Throws on any non-2xx/network error. */
async function relayPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const config = getIpfsConfig();
  if (!config) {
    throw new Error('Relay not configured — call setIpfsConfig() first');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await (config.fetch ?? fetch)(`${config.apiUrl}/api/relay/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) throw new Error('Relay request timed out');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new RelayHttpError(
      error.error || `Relay request failed: ${response.status}`,
      response.status,
      typeof error.code === 'string' ? error.code : undefined
    );
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

/**
 * Replays every queued relay write once its backoff has passed. A write the
 * relayer refuses for good (bad request, not authorized) is dropped rather than
 * retried forever; anything else waits longer each time. Writes queued while
 * the replay was running are kept.
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

async function runDrain(): Promise<{ replayed: number; failed: number }> {
  const snapshot = (await readQueue()).entries;
  if (snapshot.length === 0) return { replayed: 0, failed: 0 };

  const keep = new Map<string, RelayQueueEntry>();
  let replayed = 0;
  let failed = 0;

  for (const entry of snapshot) {
    if (!isOnline() || (entry.notBefore ?? 0) > Date.now()) {
      keep.set(entry.id, entry);
      continue;
    }
    try {
      await relayPost<RelayResult>(entry.path, entry.body);
      replayed++;
    } catch (error) {
      if (isNetworkError(error)) {
        keep.set(entry.id, entry);
        continue;
      }
      failed++;
      const permanent = error instanceof RelayHttpError && PERMANENT_STATUSES.has(error.status);
      const attempts = entry.attempts + 1;
      if (permanent || attempts >= MAX_REPLAY_ATTEMPTS) continue;
      keep.set(entry.id, { ...entry, attempts, notBefore: Date.now() + backoffFor(attempts) });
    }
  }

  // Re-read so a write queued while we were sending isn't overwritten.
  const seen = new Set(snapshot.map((e) => e.id));
  const added = (await readQueue()).entries.filter((e) => !seen.has(e.id));
  await writeQueue({ entries: [...keep.values(), ...added] });
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

/** The relayer settles: the contract accepts only its settler, and the winner is worked out server-side from the indexed record, never taken from the caller. */
export function relaySettleChallenge(challengeId: bigint): Promise<RelayResult> {
  return send('settle-challenge', { challengeId: challengeId.toString() });
}

export function relayStartSeason(durationSeconds: number): Promise<RelayResult> {
  return send('start-season', { durationSeconds });
}

/** The relayer credits the distance recorded onchain for `activityHash`, once per activity. */
export function relayRecordContribution(
  participant: string,
  amount: number,
  activityHash: `0x${string}`
): Promise<RelayResult> {
  return send('record-contribution', { participant, amount, activityHash });
}
