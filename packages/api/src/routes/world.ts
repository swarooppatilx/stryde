import { randomUUID } from 'node:crypto';
import {
  IDKit,
  IDKitErrorCodes,
  type IDKitRequest,
  selfieCheckLegacy,
} from '@worldcoin/idkit-core';
import { signRequest } from '@worldcoin/idkit-server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { keccak256, toBytes } from 'viem';
import { isAddress } from '../lib/address.js';
import { isProduction } from '../lib/env.js';
import { logError } from '../lib/logError.js';
import { ConfigError } from '../lib/relayErrors.js';
import { relayTx } from '../lib/relayerTx.js';

export const world = new Hono();

const RP_SIGNING_KEY = process.env.WORLD_RP_SIGNING_KEY;
const WORLD_APP_ID = process.env.WORLD_APP_ID;
const WORLD_RP_ID = process.env.WORLD_RP_ID;
const WORLD_ENVIRONMENT = (process.env.WORLD_ENVIRONMENT || 'sandbox') as
  | 'production'
  | 'staging'
  | 'sandbox';
// Skipping confirms proofs World never vouched for: never honoured in production.
const SKIP_REMOTE_VERIFY_REQUESTED = process.env.WORLD_SKIP_REMOTE_VERIFY === 'true';
const IS_PRODUCTION_DEPLOY = isProduction();
const SKIP_REMOTE_VERIFY = SKIP_REMOTE_VERIFY_REQUESTED && !IS_PRODUCTION_DEPLOY;
const WORLD_DEVELOPER_API_KEY = process.env.WORLD_DEVELOPER_API_KEY;

if (SKIP_REMOTE_VERIFY_REQUESTED && IS_PRODUCTION_DEPLOY) {
  console.error(
    '[world] WORLD_SKIP_REMOTE_VERIFY=true is ignored on the production deployment — every proof is verified with World.'
  );
}

if (!RP_SIGNING_KEY) {
  console.warn('[world] WORLD_RP_SIGNING_KEY not set — /world/session will return 503');
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const SESSION_GONE = 'Session not found or expired.';
const DEFAULT_RETURN_TO = 'stryde://verify';
/** The app's scheme, and the one it used before (builds already installed still send it). Nothing else is a way back. */
const RETURN_TO_PREFIXES = ['stryde://', 'strydeexpo://'] as const;
const MAX_BODY_BYTES = 16 * 1024;
/** Bounds memory: every pending session holds an IDKit request until it expires. */
const MAX_LIVE_SESSIONS = 1000;

interface SessionEntry {
  request: IDKitRequest;
  createdAt: number;
  /** Wallet address this Selfie Check is for (`signal` on session creation); mirrored onto ProfileRegistry.verify() so other users see the verification. */
  wallet: string;
}

const HEX_BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

/** World returns a bytes32 nullifier; anything else is hashed so distinct values never collide. */
function toNullifierHash(nullifier: string | null): `0x${string}` {
  return HEX_BYTES32_RE.test(nullifier ?? '')
    ? (nullifier as `0x${string}`)
    : keccak256(toBytes(nullifier ?? randomUUID()));
}

/** Best effort: the caller is already verified by World, so a failed mirror is only logged. */
async function mirrorVerificationOnchain(wallet: string, nullifier: string | null): Promise<void> {
  if (!isAddress(wallet)) {
    console.warn(`[world] Skipping onchain verify mirror: not a wallet address: ${wallet}`);
    return;
  }
  try {
    const { hash, confirmed } = await relayTx({
      contract: 'profileRegistry',
      functionName: 'verify',
      args: [wallet, toNullifierHash(nullifier)],
    });
    console.info(`[world] Mirrored verification for ${wallet}: ${hash} (confirmed=${confirmed})`);
  } catch (error) {
    logError(`[world] Onchain verify mirror failed for ${wallet}:`, error);
  }
}

class SessionLimitError extends Error {
  constructor() {
    super('Too many verifications in progress. Try again shortly.');
  }
}

const sessions = new Map<string, SessionEntry>();

function pruneSessions() {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now - entry.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
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

function describeVerifyFailure(detail: string): string {
  const text = detail.toLowerCase();
  if (text.includes('selfie') || text.includes('feature') || text.includes('not enabled')) {
    return 'Selfie Check may not be enabled for your app yet. Email developers@toolsforhumanity.com with your app ID.';
  }
  if (text.includes('invalid_proof') || text.includes('verification_failed')) {
    return 'World rejected the proof. Confirm environment and Selfie Check are enabled for your app.';
  }
  if (text.includes('rp_signature') || text.includes('timestamp')) {
    return 'RP signature expired. Tap Reset and try again.';
  }
  return 'World ID could not verify this proof. Please try again.';
}

async function verifyWithWorld(idkitResponse: unknown): Promise<unknown> {
  const targetId = WORLD_RP_ID || WORLD_APP_ID;
  if (!targetId) {
    throw new Error('World ID verification not configured');
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (WORLD_DEVELOPER_API_KEY) {
    headers.Authorization = `Bearer ${WORLD_DEVELOPER_API_KEY}`;
  }

  const response = await fetch(`https://developer.world.org/api/v4/verify/${targetId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(idkitResponse),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Verification failed (${response.status})`);
  }

  return text ? JSON.parse(text) : { success: true };
}

export interface SessionCreateResponse {
  sessionId: string;
  connectorURI: string;
}

interface PollResult {
  status: 'pending' | 'confirmed' | 'failed';
  error?: string;
  message?: string;
  result?: unknown;
}

async function createSession(signal: string, returnTo: string): Promise<SessionCreateResponse> {
  if (!RP_SIGNING_KEY || !WORLD_APP_ID || !WORLD_RP_ID) {
    throw new ConfigError('World ID (WORLD_APP_ID / WORLD_RP_ID / signing key)');
  }

  if (!signal) {
    throw new Error('Missing signal for Selfie Check session.');
  }

  pruneSessions();
  if (sessions.size >= MAX_LIVE_SESSIONS) {
    throw new SessionLimitError();
  }

  const { sig, nonce, createdAt, expiresAt } = signRequest({
    signingKeyHex: RP_SIGNING_KEY,
    action: 'stryde-verify-profile',
  });

  const request = await IDKit.request({
    app_id: WORLD_APP_ID as `app_${string}`,
    action: 'stryde-verify-profile',
    rp_context: {
      rp_id: WORLD_RP_ID,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
      signature: sig,
    },
    allow_legacy_proofs: true,
    environment: WORLD_ENVIRONMENT,
    return_to: returnTo,
    action_description: 'Verify your Stryde profile with Selfie Check',
  }).preset(selfieCheckLegacy({ signal }));

  const connectorURI = request.connectorURI;
  if (!connectorURI) {
    throw new Error('World ID did not return a connector URL.');
  }

  const sessionId = randomUUID();
  sessions.set(sessionId, { request, createdAt: Date.now(), wallet: signal });

  return { sessionId, connectorURI };
}

async function pollSession(sessionId: string): Promise<PollResult> {
  pruneSessions();
  const entry = sessions.get(sessionId);
  if (!entry) {
    throw new Error(SESSION_GONE);
  }

  const status = await entry.request.pollOnce();
  console.info(`[world] poll ${sessionId.slice(0, 8)} → ${status.type}`, status.error ?? '');

  // Anything but a final answer (waiting_for_connection, awaiting_confirmation,
  // ...) means the user hasn't finished in World App yet.
  if (status.type !== 'confirmed' && status.type !== 'failed') {
    return { status: 'pending' };
  }

  if (status.type === 'failed') {
    sessions.delete(sessionId);
    const error = status.error ?? 'generic_error';

    if (SKIP_REMOTE_VERIFY) {
      console.warn(
        `[world] World ID returned '${error}', but WORLD_SKIP_REMOTE_VERIFY=true — confirming demo verification.`
      );
      // Not mirrored onchain: ProfileRegistry.verify() is permanent and
      // public, and this nullifier is a random UUID, not a human.
      const mockNullifier = `0x${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '')}`;
      return {
        status: 'confirmed',
        result: {
          responses: [
            {
              nullifier_hash: mockNullifier,
              verification_level: 'selfie',
              action: 'stryde-verify-profile',
            },
          ],
        },
      };
    }

    if (error === IDKitErrorCodes.UserRejected || error === IDKitErrorCodes.Cancelled) {
      return {
        status: 'failed',
        error: 'cancelled',
        message: 'You dismissed the verification. Tap Reset and try again.',
      };
    }

    const message =
      error === 'generic_error'
        ? 'World ID could not complete Selfie Check. Ensure Selfie Check is enabled for your app in the Developer Portal.'
        : `World ID error: ${error}`;
    return { status: 'failed', error, message };
  }

  if (SKIP_REMOTE_VERIFY) {
    console.warn('[world] Skipping remote verify (WORLD_SKIP_REMOTE_VERIFY=true)');
  } else {
    try {
      await verifyWithWorld(status.result);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Verification failed';
      logError('[world] World verify failed:', detail);
      sessions.delete(sessionId);
      return {
        status: 'failed',
        error: 'verification_failed',
        message: describeVerifyFailure(detail),
      };
    }
  }

  sessions.delete(sessionId);
  // Only a proof World's verify endpoint accepted earns the onchain badge;
  // a skipped check stays a local demo confirmation.
  if (!SKIP_REMOTE_VERIFY) {
    const nullifier = extractNullifier(
      (status.result ?? {}) as { responses?: Array<Record<string, unknown>> }
    );
    void mirrorVerificationOnchain(entry.wallet, nullifier);
  }
  return { status: 'confirmed', result: status.result };
}

function sessionFailureMessage(error: unknown, code: string | null): string {
  if (error instanceof Error) return error.message;
  return code ? `Session creation failed (${code})` : 'Session creation failed';
}

world.post(
  '/session',
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: 'Payload too large' }, 413),
  }),
  async (c) => {
    if (!RP_SIGNING_KEY) {
      return c.json({ error: 'World ID signing not configured' }, 503);
    }

    const body = await c.req.json().catch(() => null);
    const signal = body?.signal;
    // The signal is the wallet the verification is mirrored onto; any other
    // value would pass World's check and then verify nobody onchain.
    if (!isAddress(signal)) {
      return c.json({ error: 'signal must be the wallet address being verified' }, 400);
    }
    const returnTo = body?.return_to ?? DEFAULT_RETURN_TO;
    if (
      typeof returnTo !== 'string' ||
      !RETURN_TO_PREFIXES.some((prefix) => returnTo.startsWith(prefix))
    ) {
      return c.json({ error: 'return_to must be a Stryde app link' }, 400);
    }

    try {
      const session = await createSession(signal, returnTo);
      return c.json(session);
    } catch (error) {
      // The IDKit client can throw plain objects (e.g. { code: 'invalid_rp_signature' }),
      // so don't collapse those into a message-less failure.
      if (error instanceof SessionLimitError) return c.json({ error: error.message }, 503);
      if (error instanceof ConfigError) {
        console.error('[world]', error.message);
        return c.json({ error: 'Service misconfigured' }, 503);
      }
      logError('[world] Session creation failed:', error);
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : null;
      return c.json({ error: sessionFailureMessage(error, code) }, 400);
    }
  }
);

world.post('/session/:id/poll', async (c) => {
  if (!RP_SIGNING_KEY) {
    return c.json({ error: 'World ID signing not configured' }, 503);
  }

  const sessionId = c.req.param('id');

  try {
    const result = await pollSession(sessionId);
    return c.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === SESSION_GONE) {
      return c.json({ error: SESSION_GONE }, 404);
    }
    // The detail stays in the logs: upstream/network errors can name internal hosts.
    logError('[world] Poll failed:', error);
    return c.json({ error: 'Could not check the verification. Try again.' }, 502);
  }
});

world.post(
  '/verify',
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: 'Payload too large' }, 413),
  }),
  async (c) => {
    if (!RP_SIGNING_KEY) {
      return c.json({ error: 'World ID signing not configured' }, 503);
    }

    const body = (await c.req.json().catch(() => null)) as { idkitResponse?: unknown } | null;
    const idkitResponse = body?.idkitResponse;

    if (!idkitResponse) {
      return c.json({ error: 'Missing idkitResponse' }, 400);
    }

    if (SKIP_REMOTE_VERIFY) {
      const nullifier = extractNullifier(
        idkitResponse as { responses?: Array<Record<string, unknown>> }
      );
      return c.json({ ok: true, nullifier });
    }

    try {
      const result = await verifyWithWorld(idkitResponse);
      return c.json({ ok: true, result });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Verification failed';
      logError('[world] Verify failed:', detail);
      return c.json({ error: describeVerifyFailure(detail) }, 400);
    }
  }
);
