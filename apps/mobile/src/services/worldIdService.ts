import * as Linking from 'expo-linking';
import { AppState } from 'react-native';

import { ENV } from '@/constants/config';
import type { WorldIdEnvironment, WorldVerificationError } from '@/types/worldId';

export const WORLD_VERIFY_ACTION = 'stryde-verify-profile';
export const WORLD_VERIFY_RETURN_TO = 'strydeexpo://verify';

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
  | { status: 'confirmed'; result: { responses?: Array<Record<string, unknown>> } };

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

async function createServerSession(signal: string): Promise<SessionCreateResponse> {
  const response = await fetch(`${ENV.API_URL}/world/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: WORLD_VERIFY_ACTION,
      signal,
      return_to: WORLD_VERIFY_RETURN_TO,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to start World ID session.'));
  }

  return (await response.json()) as SessionCreateResponse;
}

async function pollServerSession(sessionId: string): Promise<PollStatus> {
  const response = await fetch(`${ENV.API_URL}/world/session/${sessionId}/poll`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });

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
        message:
          'Verification timed out. Complete Selfie Check in World ID, then return to Stryde.',
      };
    case 'cancelled':
    case 'user_rejected':
    case 'user_cancelled':
      return {
        code: 'cancelled',
        message: 'You dismissed the verification. Tap "Reset and try again" to start over.',
      };
    case 'verification_failed':
      return {
        code: error,
        message:
          'World rejected the proof. Selfie Check may not be enabled for your app yet — email developers@toolsforhumanity.com.',
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
}

export async function runSelfieCheck(signal: string): Promise<SelfieCheckResult> {
  if (!isWorldIdConfigured()) {
    throw new Error(
      'World ID is not configured. Add EXPO_PUBLIC_WORLD_APP_ID and EXPO_PUBLIC_WORLD_RP_ID to .env.'
    );
  }

  const { sessionId, connectorURI } = await createServerSession(signal);

  let pollNow = false;
  const appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      pollNow = true;
    }
  });

  try {
    await Linking.openURL(connectorURI);
  } catch {
    throw new Error('Cannot open World ID. Install the World ID Sandbox app, then try again.');
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  try {
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
        throw new Error(
          'Proof received but no nullifier found. Selfie Check may not be fully enabled for your app.'
        );
      }

      return {
        nullifier,
        proof: poll.result,
      };
    }

    throw mapIdKitError('timeout');
  } finally {
    appStateSub.remove();
  }
}

export function getWorldEnvironmentLabel(environment: WorldIdEnvironment): string {
  switch (environment) {
    case 'sandbox':
      return 'Sandbox';
    case 'staging':
      return 'Staging';
    default:
      return 'Production';
  }
}
