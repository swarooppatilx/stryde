import * as Linking from 'expo-linking';
import { AppState } from 'react-native';

import { ENV } from '@/constants/config';
import type {
  AthletePass,
  PresenceTicket,
  RewardGate,
  WorldCheckKind,
  WorldVerificationError,
} from '@/types/worldId';
import { logger } from '@/utils/logger';

const WORLD_VERIFY_RETURN_TO = 'stryde://verify';

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 180_000;

export function isWorldIdConfigured(): boolean {
  return Boolean(ENV.WORLD_APP_ID && ENV.WORLD_RP_ID);
}

interface SessionCreateResponse {
  sessionId: string;
  connectorURI: string;
}

type PollStatus =
  | { status: 'pending' }
  | { status: 'failed'; error: string; message?: string }
  | {
      status: 'confirmed';
      result: { responses?: Array<Record<string, unknown>> };
      pass?: AthletePass;
      ticket?: PresenceTicket;
    };

const apiHeaders = () => ({
  'content-type': 'application/json',
  ...(ENV.API_KEY ? { 'X-API-Key': ENV.API_KEY } : {}),
});

async function readApiError(response: Response, fallback: string): Promise<string> {
  const detail = await response.text().catch(() => '');
  if (!detail) return `${fallback} (${response.status})`;
  try {
    const parsed = JSON.parse(detail) as { error?: string; message?: string };
    return parsed.message || parsed.error || detail;
  } catch {
    return detail;
  }
}

async function createServerSession(
  kind: WorldCheckKind,
  signal: string,
  activityHash?: string
): Promise<SessionCreateResponse> {
  const response = await fetch(`${ENV.API_URL}/api/world/session`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      kind,
      signal,
      activityHash,
      return_to: WORLD_VERIFY_RETURN_TO,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to start World ID session.'));
  }

  return (await response.json()) as SessionCreateResponse;
}

async function pollServerSession(sessionId: string): Promise<PollStatus> {
  let response: Response;
  try {
    response = await fetch(`${ENV.API_URL}/api/world/session/${sessionId}/poll`, {
      method: 'POST',
      headers: apiHeaders(),
    });
  } catch (error) {
    // No response at all (the phone is often switching networks while the user
    // is in the World app): keep waiting rather than ending the verification.
    logger.warn('[WorldId] Poll request failed, will retry', error);
    return { status: 'pending' };
  }

  // Rate limited or a server hiccup: wait for the next tick rather than abandon a
  // verification in progress. A 4xx like "session gone" is final.
  if (response.status === 429 || response.status >= 500) return { status: 'pending' };

  if (!response.ok) {
    throw new Error(await readApiError(response, 'World ID polling failed'));
  }

  return (await response.json()) as PollStatus;
}

function extractNullifier(result: { responses?: Array<Record<string, unknown>> }): string | null {
  for (const response of result.responses ?? []) {
    if (typeof response.nullifier === 'string' && response.nullifier) {
      return response.nullifier;
    }
    if (typeof response.nullifier_hash === 'string' && response.nullifier_hash) {
      return response.nullifier_hash;
    }
    if (Array.isArray(response.session_nullifier)) {
      const first = response.session_nullifier[0];
      if (typeof first === 'string' && first) return first;
    }
  }
  return null;
}

function mapIdKitError(error: string, detail?: string): WorldVerificationError {
  if (detail) {
    return { code: error, message: detail };
  }

  switch (error) {
    case 'timeout':
      return {
        code: error,
        message: 'Verification timed out. Complete the check in World App, then return to Stryde.',
      };
    case 'cancelled':
    case 'user_rejected':
    case 'user_cancelled':
      return {
        code: 'cancelled',
        message: 'You dismissed the check in World App. Nothing was shared.',
      };
    case 'verification_failed':
      return {
        code: error,
        message: 'World rejected the proof. Start the check again; your run is saved either way.',
      };
    default:
      return {
        code: error,
        message: 'World ID verification failed. Please try again.',
      };
  }
}

export interface SelfieCheckResult {
  nullifier: string;
  proof: { responses?: Array<Record<string, unknown>> };
  /** What the check unlocked, as the server recorded it. */
  pass?: AthletePass;
  ticket?: PresenceTicket;
}

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Runs one World ID check end to end: the server signs and holds the IDKit request, World App
 * makes the proof, and the server verifies it before anything is unlocked.
 */
export async function runWorldCheck(
  kind: WorldCheckKind,
  signal: string,
  activityHash?: string
): Promise<SelfieCheckResult> {
  if (!isWorldIdConfigured()) {
    throw new Error(
      'World ID is not configured. Add EXPO_PUBLIC_WORLD_APP_ID and EXPO_PUBLIC_WORLD_RP_ID to .env.'
    );
  }

  // The signal is the wallet the proof is bound to; the signed-out placeholder
  // would verify no one onchain.
  if (!WALLET_RE.test(signal)) {
    throw new Error('Sign in before verifying with World ID.');
  }

  const { sessionId, connectorURI } = await createServerSession(kind, signal, activityHash);

  let pollNow = false;
  const appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      pollNow = true;
    }
  });

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  try {
    try {
      await Linking.openURL(connectorURI);
    } catch {
      throw new Error('Cannot open World App. Install World App, then try again.');
    }

    while (Date.now() < deadline) {
      if (!pollNow) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      pollNow = false;

      const poll = await pollServerSession(sessionId);

      if (poll.status === 'pending') {
        continue;
      }

      if (poll.status === 'failed') {
        throw mapIdKitError(poll.error, poll.message);
      }

      const nullifier = extractNullifier(poll.result);
      if (!nullifier) {
        throw new Error('World App returned a proof Stryde could not read. Start the check again.');
      }

      return { nullifier, proof: poll.result, pass: poll.pass, ticket: poll.ticket };
    }

    throw mapIdKitError('timeout');
  } finally {
    appStateSub.remove();
  }
}

/** Athlete Pass enrollment: a World ID uniqueness proof that also opens a World ID session. */
export function runSelfieCheck(signal: string): Promise<SelfieCheckResult> {
  return runWorldCheck('enroll', signal);
}

export interface PassStatus {
  pass: AthletePass | null;
  ticket: PresenceTicket | null;
  gate: RewardGate;
}

/** The server's view of the athlete's pass, and what a run of `meters` would need to earn. */
export async function fetchPassStatus(
  wallet: string,
  query: { activityHash?: string; meters?: number } = {}
): Promise<PassStatus> {
  const params = new URLSearchParams();
  if (query.activityHash) params.set('activityHash', query.activityHash);
  if (query.meters !== undefined) params.set('meters', String(Math.round(query.meters)));
  const response = await fetch(`${ENV.API_URL}/api/world/pass/${wallet}?${params}`, {
    headers: apiHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not load your Athlete Pass'));
  }
  return (await response.json()) as PassStatus;
}
