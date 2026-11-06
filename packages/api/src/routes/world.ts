import { randomUUID } from 'node:crypto';
import {
  any,
  CredentialRequest,
  hashSignal,
  IDKit,
  IDKitErrorCodes,
  type IDKitRequest,
  proofOfHuman,
} from '@worldcoin/idkit-core';
import { signRequest } from '@worldcoin/idkit-server';
import { Hono } from 'hono';
import { keccak256, toBytes } from 'viem';
import { type Address, isAddress, toAddress } from '../lib/address.js';
import { isProduction } from '../lib/env.js';
import { isBytes32 } from '../lib/hex.js';
import {
  getHumanPresenceStore,
  normalizeSybilScore,
  PresenceError,
  type PresenceTicket,
  type PublicPass,
  rewardGate,
  toPublicPass,
} from '../lib/humanPresence.js';
import { logError } from '../lib/logError.js';
import { ConfigError, classifyRelayError, ReceiptTimeoutError } from '../lib/relayErrors.js';
import { relayTx } from '../lib/relayerTx.js';
import { limitBody } from '../middleware/jsonBody.js';

export const world = new Hono();

const RP_SIGNING_KEY = process.env.WORLD_RP_SIGNING_KEY;
const WORLD_APP_ID = process.env.WORLD_APP_ID;
const WORLD_RP_ID = process.env.WORLD_RP_ID;
const WORLD_ENVIRONMENT = (process.env.WORLD_ENVIRONMENT || 'sandbox') as
  | 'production'
  | 'staging'
  | 'sandbox';
/** One uniqueness action for every Athlete Pass: its nullifier is what stops one human holding two. */
const ENROLL_ACTION = process.env.WORLD_ENROLL_ACTION || 'stryde-athlete-pass';
const STEP_UP_ACTION = process.env.WORLD_STEP_UP_ACTION || 'stryde-step-up';
// Skipping confirms proofs World never vouched for: never honoured in production.
const SKIP_REMOTE_VERIFY_REQUESTED = process.env.WORLD_SKIP_REMOTE_VERIFY === 'true';
const IS_PRODUCTION_DEPLOY = isProduction();
const SKIP_REMOTE_VERIFY = SKIP_REMOTE_VERIFY_REQUESTED && !IS_PRODUCTION_DEPLOY;
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

/**
 * enroll: Selfie Check uniqueness proof that also opens a World ID session (the Athlete Pass).
 * presence: proof of that same session, bound to one run (the Finish-Line check).
 * step_up: Proof of Human, asked only of a pass whose Sybil score band is high.
 */
type CheckKind = 'enroll' | 'presence' | 'step_up';
const CHECK_KINDS: readonly CheckKind[] = ['enroll', 'presence', 'step_up'];

interface SessionEntry {
  request: IDKitRequest;
  createdAt: number;
  kind: CheckKind;
  /** Wallet the check is for; mirrored onto ProfileRegistry.verify() after enrollment so other users see the badge. */
  wallet: Address;
  /** The run a Finish-Line check vouches for; its hash is the proof's signal. */
  activityHash?: `0x${string}`;
}

const DECIMAL_RE = /^[0-9]+$/;

/** World returns the nullifier as a decimal or bytes32 hex; anything else is hashed so distinct values never collide. */
function toNullifierHash(nullifier: string | null): `0x${string}` {
  if (nullifier && isBytes32(nullifier)) return nullifier as `0x${string}`;
  if (nullifier && DECIMAL_RE.test(nullifier)) {
    const hex = BigInt(nullifier).toString(16);
    if (hex.length <= 64) return `0x${hex.padStart(64, '0')}`;
  }
  return keccak256(toBytes(nullifier ?? randomUUID()));
}

const MIRROR_ATTEMPTS = 3;
const MIRROR_BACKOFF_MS = 2000;

/** Best effort: the caller is already verified by World, so a mirror that still fails after retries is only logged. */
async function mirrorVerificationOnchain(wallet: string, nullifier: string | null): Promise<void> {
  if (!isAddress(wallet)) {
    console.warn(`[world] Skipping onchain verify mirror: not a wallet address: ${wallet}`);
    return;
  }
  // The nullifier is what stops one human verifying many wallets; without it there is nothing to bind.
  if (!nullifier) {
    console.warn(`[world] Skipping onchain verify mirror: no nullifier in the proof for ${wallet}`);
    return;
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const { hash, confirmed } = await relayTx({
        contract: 'profileRegistry',
        functionName: 'verify',
        args: [wallet, toNullifierHash(nullifier)],
      });
      console.info(`[world] Mirrored verification for ${wallet}: ${hash} (confirmed=${confirmed})`);
      return;
    } catch (error) {
      // A send that may still mine is never repeated; a definite refusal will not change.
      const failure = classifyRelayError(error);
      const retryable =
        !(error instanceof ReceiptTimeoutError) && (!failure || failure.status === 503);
      if (!retryable || attempt === MIRROR_ATTEMPTS) {
        logError(`[world] Onchain verify mirror failed for ${wallet}:`, error);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, MIRROR_BACKOFF_MS * attempt));
    }
  }
}

class SessionLimitError extends Error {
  constructor() {
    super('Too many verifications in progress. Try again shortly.');
  }
}

/** A proof World accepted that still fails Stryde's own checks (wrong signal, wrong session, replay). */
class ProofCheckError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
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

type ResultItem = Record<string, unknown>;
type ProofResult = {
  action?: string;
  session_id?: string;
  environment?: string;
  responses?: ResultItem[];
};

function extractNullifier(result: { responses?: ResultItem[] }): string | null {
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

type LivenessCredential = 'selfie' | 'proof_of_human';
const KNOWN_LIVENESS: readonly LivenessCredential[] = ['selfie', 'proof_of_human'];

/**
 * Credentials that prove a live, unique human for the Athlete Pass: a Selfie Check, the Orb's Proof of
 * Human, or either. WORLD_PASS_CREDENTIALS picks them (comma-separated); by default either is accepted.
 * World App in production hangs on an either/or that includes Selfie Check while Selfie Check isn't
 * enabled for the app, so production can be narrowed to `proof_of_human`.
 */
const LIVENESS_CREDENTIALS: readonly LivenessCredential[] = (() => {
  const picked = (process.env.WORLD_PASS_CREDENTIALS ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is LivenessCredential =>
      (KNOWN_LIVENESS as readonly string[]).includes(part)
    );
  return picked.length > 0 ? picked : KNOWN_LIVENESS;
})();

/** One credential is asked for as is; several as "any of", and World returns whichever the person holds. */
function livenessConstraint(signal: string) {
  const requests = LIVENESS_CREDENTIALS.map((type) => CredentialRequest(type, { signal }));
  return requests.length === 1
    ? (requests[0] as ReturnType<typeof CredentialRequest>)
    : any(...requests);
}

function livenessItem(result: ProofResult): ResultItem | undefined {
  return result.responses?.find(
    (item) =>
      (typeof item.identifier === 'string' &&
        (LIVENESS_CREDENTIALS as readonly string[]).includes(item.identifier)) ||
      item.issuer_schema_id === 11
  );
}

/** World verifies the proof against the signal hash it carries; this checks that hash is of the value Stryde asked for. */
function requireSignal(item: ResultItem | undefined, signal: string) {
  const carried = typeof item?.signal_hash === 'string' ? item.signal_hash : null;
  if (!carried || BigInt(carried) !== BigInt(hashSignal(signal))) {
    throw new ProofCheckError(
      'signal_mismatch',
      'This proof was made for something else. Start the check again.'
    );
  }
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
  // The verify API treats a missing environment as production.
  const environment = (idkitResponse as ProofResult | null)?.environment ?? 'production';
  if (environment !== WORLD_ENVIRONMENT) {
    throw new Error(`invalid_proof: environment ${environment}, expected ${WORLD_ENVIRONMENT}`);
  }

  const response = await fetch(`https://developer.world.org/api/v4/verify/${targetId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(idkitResponse),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Verification failed (${response.status})`);
  }

  const verification = (text ? JSON.parse(text) : {}) as {
    success?: boolean;
    environment?: string;
  };
  if (verification.success !== true) {
    throw new Error(text || 'Verification failed');
  }
  if (verification.environment && verification.environment !== WORLD_ENVIRONMENT) {
    throw new Error(
      `invalid_proof: verified in ${verification.environment}, expected ${WORLD_ENVIRONMENT}`
    );
  }
  return verification;
}

export interface SessionCreateResponse {
  sessionId: string;
  connectorURI: string;
  kind: CheckKind;
}

interface PollResult {
  status: 'pending' | 'confirmed' | 'failed';
  kind?: CheckKind;
  error?: string;
  message?: string;
  result?: unknown;
  pass?: PublicPass;
  ticket?: PresenceTicket;
}

function rpContext(action?: string) {
  const { sig, nonce, createdAt, expiresAt } = signRequest({
    signingKeyHex: RP_SIGNING_KEY as string,
    ...(action ? { action } : {}),
  });
  return {
    rp_id: WORLD_RP_ID as string,
    nonce,
    created_at: createdAt,
    expires_at: expiresAt,
    signature: sig,
  };
}

async function buildRequest(
  kind: CheckKind,
  wallet: Address,
  returnTo: string,
  activityHash?: `0x${string}`
): Promise<IDKitRequest> {
  const app_id = WORLD_APP_ID as `app_${string}`;
  const common = { app_id, environment: WORLD_ENVIRONMENT, return_to: returnTo };

  if (kind === 'enroll') {
    return IDKit.request({
      ...common,
      action: ENROLL_ACTION,
      session_id: 'create',
      rp_context: rpContext(ENROLL_ACTION),
      allow_legacy_proofs: false,
      action_description: 'Get your Stryde Athlete Pass',
    }).constraints(livenessConstraint(wallet));
  }

  if (kind === 'presence') {
    const pass = getHumanPresenceStore().getPass(wallet);
    if (!pass) throw new PresenceError('no_pass', 'Get your Athlete Pass first.');
    return IDKit.proveSession(pass.sessionId, {
      ...common,
      rp_context: rpContext(),
      action_description: 'Finish line: confirm you ran this',
    }).constraints(livenessConstraint(activityHash as string));
  }

  return IDKit.request({
    ...common,
    action: STEP_UP_ACTION,
    rp_context: rpContext(STEP_UP_ACTION),
    allow_legacy_proofs: true,
    action_description: 'Unlock earning on Stryde with Proof of Human',
  }).preset(proofOfHuman({ signal: wallet }));
}

async function createSession(
  kind: CheckKind,
  wallet: Address,
  returnTo: string,
  activityHash?: `0x${string}`
): Promise<SessionCreateResponse> {
  if (!RP_SIGNING_KEY || !WORLD_APP_ID || !WORLD_RP_ID) {
    throw new ConfigError('World ID (WORLD_APP_ID / WORLD_RP_ID / signing key)');
  }

  pruneSessions();
  if (sessions.size >= MAX_LIVE_SESSIONS) {
    throw new SessionLimitError();
  }

  const request = await buildRequest(kind, wallet, returnTo, activityHash);
  const connectorURI = request.connectorURI;
  if (!connectorURI) {
    throw new Error('World ID did not return a connector URL.');
  }

  const sessionId = randomUUID();
  sessions.set(sessionId, { request, createdAt: Date.now(), kind, wallet, activityHash });

  return { sessionId, connectorURI, kind };
}

/** An Orb Proof of Human is World's strongest uniqueness check and carries no Sybil score: it counts as the lowest risk. */
function enrollmentSybilScore(item: ResultItem | undefined): number | null {
  if (item?.identifier === 'proof_of_human' && item.sybil_score === undefined) return 0;
  return normalizeSybilScore(item?.sybil_score);
}

/** Stryde's checks on a proof World has accepted, and what it unlocks. */
function settle(entry: SessionEntry, result: ProofResult): Pick<PollResult, 'pass' | 'ticket'> {
  const store = getHumanPresenceStore();
  const now = Date.now();

  if (entry.kind === 'enroll') {
    if (result.action !== ENROLL_ACTION || !result.session_id?.startsWith('session_')) {
      throw new ProofCheckError(
        'unexpected_proof',
        'World returned a proof for a different request.'
      );
    }
    const item = livenessItem(result);
    requireSignal(item, entry.wallet);
    const nullifier = typeof item?.nullifier === 'string' ? item.nullifier : null;
    if (!nullifier) throw new ProofCheckError('unexpected_proof', 'The proof has no nullifier.');
    const pass = store.enroll({
      wallet: entry.wallet,
      sessionId: result.session_id as `session_${string}`,
      nullifier,
      sybilScore: enrollmentSybilScore(item),
      now,
    });
    return { pass: toPublicPass(pass) };
  }

  if (entry.kind === 'presence') {
    const item = livenessItem(result);
    requireSignal(item, entry.activityHash as string);
    const sessionNullifier = Array.isArray(item?.session_nullifier)
      ? item.session_nullifier[0]
      : null;
    if (typeof sessionNullifier !== 'string') {
      throw new ProofCheckError('unexpected_proof', 'The proof has no session nullifier.');
    }
    const { pass, ticket } = store.recordPresence({
      wallet: entry.wallet,
      sessionId: String(result.session_id),
      sessionNullifier,
      activityHash: entry.activityHash as `0x${string}`,
      sybilScore: normalizeSybilScore(item?.sybil_score),
      now,
    });
    return { pass: toPublicPass(pass), ticket };
  }

  const item = result.responses?.[0];
  requireSignal(item, entry.wallet);
  const nullifier = extractNullifier(result);
  if (!nullifier) throw new ProofCheckError('unexpected_proof', 'The proof has no nullifier.');
  return { pass: toPublicPass(store.recordStepUp({ wallet: entry.wallet, nullifier, now })) };
}

async function pollSession(sessionId: string): Promise<PollResult> {
  pruneSessions();
  const entry = sessions.get(sessionId);
  if (!entry) {
    throw new Error(SESSION_GONE);
  }
  const { kind } = entry;

  const status = await entry.request.pollOnce();
  console.info(
    `[world] poll ${kind} ${sessionId.slice(0, 8)} → ${status.type}`,
    status.error ?? ''
  );

  // Anything but a final answer (waiting_for_connection, awaiting_confirmation,
  // ...) means the user hasn't finished in World App yet.
  if (status.type !== 'confirmed' && status.type !== 'failed') {
    return { status: 'pending', kind };
  }

  if (status.type === 'failed') {
    sessions.delete(sessionId);
    const error = status.error ?? 'generic_error';

    if (SKIP_REMOTE_VERIFY && kind === 'enroll') {
      console.warn(
        `[world] World ID returned '${error}', but WORLD_SKIP_REMOTE_VERIFY=true — confirming demo verification.`
      );
      // Not mirrored onchain and no Athlete Pass: ProfileRegistry.verify() is permanent and
      // public, and this nullifier is a random UUID, not a human.
      const mockNullifier = `0x${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '')}`;
      return {
        status: 'confirmed',
        kind,
        result: {
          responses: [
            {
              nullifier_hash: mockNullifier,
              verification_level: 'selfie',
              action: ENROLL_ACTION,
            },
          ],
        },
      };
    }

    if (error === IDKitErrorCodes.UserRejected || error === IDKitErrorCodes.Cancelled) {
      return {
        status: 'failed',
        kind,
        error: 'cancelled',
        message: 'You dismissed the check in World App. Nothing was shared.',
      };
    }

    return { status: 'failed', kind, error, message: worldErrorMessage(error, kind) };
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
        kind,
        error: 'verification_failed',
        message: describeVerifyFailure(detail),
      };
    }
  }

  sessions.delete(sessionId);
  const result = (status.result ?? {}) as ProofResult;

  let unlocked: Pick<PollResult, 'pass' | 'ticket'> = {};
  if (!SKIP_REMOTE_VERIFY) {
    try {
      unlocked = settle(entry, result);
    } catch (error) {
      if (error instanceof ProofCheckError || error instanceof PresenceError) {
        console.warn(`[world] ${kind} proof refused: ${error.code}`);
        return { status: 'failed', kind, error: error.code, message: error.message };
      }
      throw error;
    }
  }

  // Only a proof World's verify endpoint accepted earns the onchain badge;
  // a skipped check stays a local demo confirmation.
  if (kind === 'enroll' && !SKIP_REMOTE_VERIFY) {
    // Awaited: a serverless function may be frozen once it has answered, dropping a detached write.
    await mirrorVerificationOnchain(entry.wallet, extractNullifier(result));
  }
  return { status: 'confirmed', kind, result: status.result, ...unlocked };
}

/** What each IDKit failure means for this athlete, in their words. */
function worldErrorMessage(error: string, kind: CheckKind): string {
  switch (error) {
    case 'feature_unavailable':
    case 'credential_unavailable':
      return kind === 'step_up'
        ? 'Proof of Human needs an Orb-verified World ID. Your runs stay saved; earning stays paused until then.'
        : 'Selfie Check is not available on this World App yet. Update World App and try again; your run is saved either way.';
    case 'world_id_4_not_available':
      return 'This needs World ID 4.0. Update World App, then try again.';
    case 'user_presence_failed':
      return 'The camera check did not finish. Find good light and try again.';
    case 'max_verifications_reached':
    case 'nullifier_replayed':
      return 'This World ID already holds an Athlete Pass.';
    case 'connection_failed':
      return 'Could not reach World App. Check your connection and try again.';
    case 'generic_error':
      return 'World ID could not complete Selfie Check. Ensure Selfie Check is enabled for your app in the Developer Portal.';
    default:
      return `World ID error: ${error}`;
  }
}

function sessionFailureMessage(error: unknown, code: string | null): string {
  if (error instanceof Error) return error.message;
  return code ? `Session creation failed (${code})` : 'Session creation failed';
}

world.post('/session', limitBody(MAX_BODY_BYTES), async (c) => {
  if (!RP_SIGNING_KEY) {
    return c.json({ error: 'World ID signing not configured' }, 503);
  }

  const body = await c.req.json().catch(() => null);
  // The signal is the wallet the verification is mirrored onto; any other
  // value would pass World's check and then verify nobody onchain.
  const wallet = toAddress(body?.signal);
  if (!wallet) {
    return c.json({ error: 'signal must be the wallet address being verified' }, 400);
  }
  const kind: CheckKind = body?.kind ?? 'enroll';
  if (!CHECK_KINDS.includes(kind)) {
    return c.json({ error: 'kind must be enroll, presence or step_up' }, 400);
  }
  const activityHash = body?.activityHash;
  if (kind === 'presence' && !(typeof activityHash === 'string' && isBytes32(activityHash))) {
    return c.json({ error: 'activityHash must be the 32-byte hash of the run' }, 400);
  }
  if (kind !== 'enroll' && !getHumanPresenceStore().getPass(wallet)) {
    return c.json({ error: 'Get your Athlete Pass first.', code: 'enroll_required' }, 409);
  }
  const returnTo = body?.return_to ?? DEFAULT_RETURN_TO;
  if (
    typeof returnTo !== 'string' ||
    !RETURN_TO_PREFIXES.some((prefix) => returnTo.startsWith(prefix))
  ) {
    return c.json({ error: 'return_to must be a Stryde app link' }, 400);
  }

  try {
    const session = await createSession(
      kind,
      wallet,
      returnTo,
      kind === 'presence' ? (activityHash.toLowerCase() as `0x${string}`) : undefined
    );
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
    if (error instanceof Error && error.message === SESSION_GONE) {
      return c.json({ error: SESSION_GONE }, 404);
    }
    // The detail stays in the logs: upstream/network errors can name internal hosts.
    logError('[world] Poll failed:', error);
    return c.json({ error: 'Could not check the verification. Try again.' }, 502);
  }
});

/** The athlete's pass and what a run of `meters` would need right now; never the session id or nullifier. */
world.get('/pass/:wallet', (c) => {
  const wallet = toAddress(c.req.param('wallet'));
  if (!wallet) return c.json({ error: 'Not a wallet address' }, 400);
  const store = getHumanPresenceStore();
  const pass = store.getPass(wallet);
  const activityHash = c.req.query('activityHash');
  const meters = Number(c.req.query('meters') ?? 0);
  const ticket = activityHash ? store.getTicket(activityHash) : undefined;
  return c.json({
    pass: pass ? toPublicPass(pass) : null,
    ticket: ticket ?? null,
    gate: rewardGate(pass, ticket, Number.isFinite(meters) ? meters : 0),
  });
});

world.post('/verify', limitBody(MAX_BODY_BYTES), async (c) => {
  if (!RP_SIGNING_KEY) {
    return c.json({ error: 'World ID signing not configured' }, 503);
  }

  const body = (await c.req.json().catch(() => null)) as { idkitResponse?: unknown } | null;
  const idkitResponse = body?.idkitResponse;

  if (!idkitResponse) {
    return c.json({ error: 'Missing idkitResponse' }, 400);
  }

  if (SKIP_REMOTE_VERIFY) {
    const nullifier = extractNullifier(idkitResponse as { responses?: ResultItem[] });
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
});
