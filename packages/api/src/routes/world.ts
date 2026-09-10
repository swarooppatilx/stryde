import {
  IDKit,
  IDKitErrorCodes,
  type IDKitRequest,
  selfieCheckLegacy,
} from '@worldcoin/idkit-core';
import { signRequest } from '@worldcoin/idkit-server';
import { randomUUID } from 'crypto';
import { Hono } from 'hono';

export const world = new Hono();

const RP_SIGNING_KEY = process.env.WORLD_RP_SIGNING_KEY;
const WORLD_APP_ID = process.env.WORLD_APP_ID;
const WORLD_RP_ID = process.env.WORLD_RP_ID;
const WORLD_ENVIRONMENT = (process.env.WORLD_ENVIRONMENT || 'sandbox') as
  | 'production'
  | 'staging'
  | 'sandbox';
const SKIP_REMOTE_VERIFY = process.env.WORLD_SKIP_REMOTE_VERIFY === 'true';
const WORLD_DEVELOPER_API_KEY = process.env.WORLD_DEVELOPER_API_KEY;

if (!RP_SIGNING_KEY) {
  console.warn('[world] WORLD_RP_SIGNING_KEY not set — /world/session will return 503');
}

const SESSION_TTL_MS = 30 * 60 * 1000;

interface SessionEntry {
  request: IDKitRequest;
  createdAt: number;
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
  return detail;
}

async function verifyWithWorld(idkitResponse: unknown): Promise<unknown> {
  const targetId = WORLD_RP_ID || WORLD_APP_ID;
  if (!targetId) {
    throw new Error('World ID verification not configured');
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (WORLD_DEVELOPER_API_KEY) {
    headers['Authorization'] = `Bearer ${WORLD_DEVELOPER_API_KEY}`;
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
    throw new Error('World ID not configured on server');
  }

  if (!signal) {
    throw new Error('Missing signal for Selfie Check session.');
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
  sessions.set(sessionId, { request, createdAt: Date.now() });

  return { sessionId, connectorURI };
}

async function pollSession(sessionId: string): Promise<PollResult> {
  pruneSessions();
  const entry = sessions.get(sessionId);
  if (!entry) {
    throw new Error('Session not found or expired.');
  }

  const status = await entry.request.pollOnce();
  console.log(`[world] poll ${sessionId.slice(0, 8)} → ${status.type}`, status.error ?? '');

  if (status.type === 'awaiting_confirmation') {
    return { status: 'pending' };
  }

  if (status.type === 'failed') {
    sessions.delete(sessionId);
    const error = status.error ?? 'generic_error';

    if (SKIP_REMOTE_VERIFY) {
      console.warn(
        `[world] World ID returned '${error}', but WORLD_SKIP_REMOTE_VERIFY=true — confirming demo verification.`
      );
      const mockNullifier = '0x' + randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
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

  if (!SKIP_REMOTE_VERIFY) {
    try {
      await verifyWithWorld(status.result);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Verification failed';
      console.error('[world] World verify failed:', detail);
      sessions.delete(sessionId);
      return {
        status: 'failed',
        error: 'verification_failed',
        message: describeVerifyFailure(detail),
      };
    }
  } else {
    console.warn('[world] Skipping remote verify (WORLD_SKIP_REMOTE_VERIFY=true)');
  }

  sessions.delete(sessionId);
  return { status: 'confirmed', result: status.result };
}

world.post('/session', async (c) => {
  if (!RP_SIGNING_KEY) {
    return c.json({ error: 'World ID signing not configured' }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const signal = body?.signal;
  const returnTo = body?.return_to || 'strydeexpo://verify';

  try {
    const session = await createSession(signal, returnTo);
    return c.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Session creation failed';
    return c.json({ error: message }, 400);
  }
});

world.post('/session/:id/poll', async (c) => {
  if (!RP_SIGNING_KEY) {
    return c.json({ error: 'World ID signing not configured' }, 503);
  }

  const sessionId = c.req.param('id');

  try {
    const result = await pollSession(sessionId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Poll failed';
    return c.json({ error: message }, message === 'Session not found or expired.' ? 404 : 500);
  }
});

world.post('/verify', async (c) => {
  if (!RP_SIGNING_KEY) {
    return c.json({ error: 'World ID signing not configured' }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const { idkitResponse } = body as { idkitResponse?: unknown };

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
    const message = error instanceof Error ? error.message : 'Verification failed';
    return c.json({ error: message }, 400);
  }
});
