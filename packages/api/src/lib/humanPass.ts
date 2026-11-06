import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getRelayChainConfig } from './chainConfig.js';
import { checkRewardGate } from './humanPresence.js';
import { expectedIssuer, getIdentityProvider } from './identityProvider.js';
import { logError } from './logError.js';
import { lookupRecordedActivity } from './recordedActivity.js';
import { RELAY_ABIS } from './relayAbis.js';
import { RetryLaterError } from './relayErrors.js';
import { getRelayerPublicClient, getRelayerWallet } from './relayer.js';
import { type Approval, type ApprovalStatus, store } from './store.js';
import { ACR_ORB, ACR_ORB_FACE, ACR_SELFIE, ACR_SELFIE_FACE, type ValidatedIdentity } from './worldOidc.js';

/** Allowed clock skew when comparing World's auth_time with the attempt start. */
const AUTH_TIME_SKEW_SEC = 30;
const APPROVAL_TTL_MS = 10 * 60 * 1000;
/** Same cap as /relay/mint-reward: nobody covers more than 1000 km in one activity. */
const MAX_REWARD_DISTANCE_M = 1_000_000n;
const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export interface ActionContext {
  wallet: `0x${string}`;
  identity: ValidatedIdentity;
  params: Record<string, unknown>;
  approval: Approval;
}

export interface ActionPolicy {
  label: string;
  /** May this attempt enroll a World ID that isn't linked to any Stryde wallet yet? */
  enroll: boolean;
  /** The World ID must already be linked to a *different* wallet (account recovery). */
  recovery: boolean;
  /** Agents may request this action (the human still approves in World App). */
  agentAllowed: boolean;
  /** Acceptable `acr` values. Empty means any World ID account class. */
  acceptableAcr: string[];
  validate(params: Record<string, unknown>): string | null;
  /**
   * Runs before the World ID prompt. Rejects requests that could never succeed and returns
   * the params to store, so the human approves what will really happen.
   */
  prepare?(ctx: { wallet: `0x${string}`; params: Record<string, unknown> }): Promise<Record<string, unknown>>;
  execute(ctx: ActionContext): Promise<Record<string, unknown>>;
}

export class HumanPassError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 428 | 503 = 400
  ) {
    super(message);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * What an activity is worth, read from the chain, never from the request: the owner, the
 * recorded distance and the presence gate, exactly as /relay/mint-reward checks them.
 */
async function resolveActivityReward(wallet: `0x${string}`, activityId: bigint) {
  const config = getRelayChainConfig();
  const publicClient = getRelayerPublicClient();
  const [activityHash, owner] = (await publicClient.readContract({
    address: config.contracts.activityRegistry!,
    abi: RELAY_ABIS.activityRegistry,
    functionName: 'getActivity',
    args: [activityId],
  })) as readonly [`0x${string}`, `0x${string}`, bigint];
  if (owner.toLowerCase() !== wallet.toLowerCase()) {
    throw new HumanPassError('not_owner', 'That activity belongs to another athlete.', 403);
  }

  const rewarded = (await publicClient.readContract({
    address: config.contracts.moveToEarnToken!,
    abi: RELAY_ABIS.moveToEarnToken,
    functionName: 'isRewarded',
    args: [activityHash],
  })) as boolean;
  if (rewarded) throw new HumanPassError('already_rewarded', 'This activity was already rewarded.', 409);

  const recorded = await lookupRecordedActivity(activityHash).catch((error) => {
    // A flaky RPC is worth a retry: say so instead of failing with a bare 500.
    if (!(error instanceof RetryLaterError)) throw error;
    logError('[human] Recorded activity lookup failed', error);
    throw new HumanPassError('chain_unavailable', error.message, 503);
  });
  if (!recorded) {
    throw new HumanPassError('not_indexed', 'Activity is not visible onchain yet; try again shortly.', 503);
  }
  if (recorded.owner.toLowerCase() !== wallet.toLowerCase()) {
    throw new HumanPassError('not_owner', 'That activity belongs to another athlete.', 403);
  }
  const meters = recorded.distance > MAX_REWARD_DISTANCE_M ? MAX_REWARD_DISTANCE_M : recorded.distance;
  if (meters === 0n) throw new HumanPassError('no_distance', 'The recorded activity has no distance.');

  const gate = checkRewardGate(wallet, activityHash, Number(meters));
  if (!gate.ok) throw new HumanPassError(gate.code, gate.message, 428);
  return { activityHash, meters };
}

function rewardAcr(): string[] {
  switch (process.env.REWARD_CLAIM_ACR) {
    case 'orb':
      return [ACR_ORB, ACR_ORB_FACE];
    case 'selfie':
      return [ACR_ORB, ACR_ORB_FACE, ACR_SELFIE, ACR_SELFIE_FACE];
    default:
      return [];
  }
}

export const ACTIONS: Record<string, ActionPolicy> = {
  link_human: {
    label: 'Link your World ID to this Stryde account',
    enroll: true,
    recovery: false,
    agentAllowed: false,
    acceptableAcr: [],
    validate: () => null,
    async execute({ wallet, identity }) {
      store.upsertLink({
        iss: identity.iss,
        sub: identity.sub,
        wallet,
        linkedAt: Date.now(),
        previousWallets: [],
      });
      return { linked: true };
    },
  },

  recover_account: {
    label: 'Move your Stryde identity to this device',
    enroll: false,
    recovery: true,
    agentAllowed: false,
    acceptableAcr: [],
    validate: () => null,
    async execute({ wallet, identity }) {
      const existing = store.findLinkBySubject(identity.iss, identity.sub);
      if (!existing) throw new HumanPassError('not_linked', 'No Stryde account is linked to this World ID.');
      const previousWallet = existing.wallet;
      store.upsertLink({
        ...existing,
        wallet,
        previousWallets: [...new Set([...existing.previousWallets, previousWallet])],
      });
      return { recovered: true, previousWallet };
    },
  },

  issue_agent_token: {
    label: 'Allow an AI agent to act for you (each sensitive action still needs World ID)',
    enroll: false,
    recovery: false,
    agentAllowed: false,
    acceptableAcr: [],
    validate(params) {
      const label = params.label;
      if (label !== undefined && (typeof label !== 'string' || label.length > 60)) {
        return 'label must be a string of at most 60 characters';
      }
      return null;
    },
    async execute({ wallet, identity, params }) {
      const token = `stryde_agent_${randomBytes(24).toString('base64url')}`;
      const grantId = randomUUID();
      store.addAgentGrant({
        id: grantId,
        tokenHash: hashToken(token),
        iss: identity.iss,
        sub: identity.sub,
        wallet,
        label: typeof params.label === 'string' && params.label ? params.label : 'Stryde Coach',
        createdAt: Date.now(),
        revokedAt: null,
      });
      return { grantId, token };
    },
  },

  claim_activity_reward: {
    label: 'Mint STRD rewards for a recorded activity',
    enroll: false,
    recovery: false,
    agentAllowed: true,
    acceptableAcr: rewardAcr(),
    validate(params) {
      const activityId = Number(params.activityId);
      if (!Number.isInteger(activityId) || activityId <= 0) return 'activityId must be a positive integer';
      return null;
    },
    // Any distance in the request is ignored: the reward is for the distance recorded onchain.
    async prepare({ wallet, params }) {
      const activityId = Number(params.activityId);
      const { meters } = await resolveActivityReward(wallet, BigInt(activityId));
      return { activityId, distanceM: Number(meters) };
    },
    async execute({ wallet, params }) {
      const config = getRelayChainConfig();
      // Checked again: the activity may have been rewarded while the human was approving.
      const { activityHash, meters } = await resolveActivityReward(wallet, BigInt(Number(params.activityId)));
      const relayer = getRelayerWallet();
      const hash = await relayer.writeContract({
        address: config.contracts.moveToEarnToken!,
        abi: RELAY_ABIS.moveToEarnToken,
        functionName: 'mintForActivity',
        args: [wallet, activityHash, meters],
        account: relayer.account!,
        chain: config.chain,
      });
      const receipt = await getRelayerPublicClient().waitForTransactionReceipt({ hash });
      return { txHash: hash, confirmed: receipt.status === 'success', activityHash, distanceM: Number(meters) };
    },
  },
};

export const AGENT_ACTIONS = Object.entries(ACTIONS)
  .filter(([, policy]) => policy.agentAllowed)
  .map(([name]) => name);

export interface PublicApproval {
  id: string;
  action: string;
  actionLabel: string;
  params: Record<string, unknown>;
  initiator: 'app' | 'agent';
  status: ApprovalStatus;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  createdAt: number;
  expiresAt: number;
  result: Record<string, unknown> | null;
  error: string | null;
}

export function toPublicApproval(approval: Approval): PublicApproval {
  const terminal = approval.status !== 'pending';
  return {
    id: approval.id,
    action: approval.action,
    actionLabel: ACTIONS[approval.action]?.label ?? approval.action,
    params: approval.params,
    initiator: approval.initiator,
    status: approval.status,
    userCode: terminal ? '' : approval.userCode,
    verificationUri: terminal ? '' : approval.verificationUri,
    verificationUriComplete: terminal ? '' : approval.verificationUriComplete,
    createdAt: approval.createdAt,
    expiresAt: approval.expiresAt,
    result: approval.result,
    error: approval.error,
  };
}

function paramsDigest(action: string, wallet: string, params: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify({ action, wallet: wallet.toLowerCase(), params }))
    .digest('hex');
}

export async function createApproval(input: {
  wallet: string;
  action: string;
  params: Record<string, unknown>;
  initiator: 'app' | 'agent';
  agentGrantId?: string | null;
  clientSecret?: string | null;
}): Promise<Approval> {
  const provider = getIdentityProvider();
  if (!provider) {
    throw new HumanPassError('not_configured', 'World ID Agent Pass is not configured on this server.', 503);
  }
  if (!HEX_ADDRESS_RE.test(input.wallet)) throw new HumanPassError('bad_wallet', 'wallet must be an address');

  const policy = ACTIONS[input.action];
  if (!policy) throw new HumanPassError('unknown_action', `Unknown action: ${input.action}`, 404);
  if (input.initiator === 'agent' && !policy.agentAllowed) {
    throw new HumanPassError('agent_forbidden', 'Agents cannot request this action.', 403);
  }
  const invalid = policy.validate(input.params);
  if (invalid) throw new HumanPassError('bad_params', invalid);

  const link = store.findLinkByWallet(input.wallet);
  if (link && store.findBan(link.iss, link.sub)) {
    throw new HumanPassError('banned', 'This athlete is suspended from Stryde.', 403);
  }
  if (!link && !policy.enroll && !policy.recovery) {
    throw new HumanPassError('not_linked', 'Link your World ID before using this action.', 409);
  }
  const params = policy.prepare
    ? await policy.prepare({ wallet: input.wallet as `0x${string}`, params: input.params })
    : input.params;

  const device = await provider.start({
    acceptableAcr: policy.acceptableAcr.length ? policy.acceptableAcr : undefined,
    expectedSub: link && !policy.recovery ? link.sub : undefined,
  });

  const now = Date.now();
  const approval: Approval = {
    id: randomUUID(),
    wallet: input.wallet,
    action: input.action,
    params,
    paramsHash: paramsDigest(input.action, input.wallet, params),
    initiator: input.initiator,
    agentGrantId: input.agentGrantId ?? null,
    clientSecretHash: input.clientSecret ? hashToken(input.clientSecret) : null,
    status: 'pending',
    createdAt: now,
    expiresAt: now + Math.min(APPROVAL_TTL_MS, device.expiresIn * 1000),
    deviceCode: device.deviceCode,
    userCode: device.userCode,
    verificationUri: device.verificationUri,
    verificationUriComplete: device.verificationUriComplete,
    pollIntervalSec: device.interval,
    nextPollAt: now + device.interval * 1000,
    requiredAcr: policy.acceptableAcr.length ? policy.acceptableAcr.join(' ') : null,
    authTime: null,
    acr: null,
    amr: null,
    sub: null,
    result: null,
    error: null,
    updatedAt: now,
  };
  store.addApproval(approval);
  return approval;
}

function fail(approval: Approval, status: ApprovalStatus, error: string): Approval {
  return store.updateApproval(approval.id, { status, error })!;
}

/**
 * Checks everything the World docs require before a protected operation runs:
 * a fresh authentication bound to this attempt, an acceptable account class,
 * no suspension, and an identity that matches (or may enroll into) the wallet.
 */
export function authorizeIdentity(approval: Approval, identity: ValidatedIdentity): string | null {
  const policy = ACTIONS[approval.action];
  if (!policy) return 'unknown_action';

  if (identity.iss !== expectedIssuer()) return 'issuer_mismatch';

  const nowSec = Math.floor(Date.now() / 1000);
  const startedSec = Math.floor(approval.createdAt / 1000);
  if (identity.authTime < startedSec - AUTH_TIME_SKEW_SEC) return 'stale_authentication';
  if (identity.authTime > nowSec + AUTH_TIME_SKEW_SEC) return 'future_authentication';

  if (policy.acceptableAcr.length && !policy.acceptableAcr.includes(identity.acr ?? '')) {
    return 'insufficient_assurance';
  }

  if (store.findBan(identity.iss, identity.sub)) return 'banned';

  const walletLink = store.findLinkByWallet(approval.wallet);
  const subjectLink = store.findLinkBySubject(identity.iss, identity.sub);

  if (policy.recovery) {
    if (!subjectLink) return 'not_linked';
    if (walletLink && walletLink.sub !== identity.sub) return 'wallet_linked_to_other_human';
    return null;
  }
  if (walletLink) {
    return walletLink.iss === identity.iss && walletLink.sub === identity.sub ? null : 'identity_mismatch';
  }
  if (!policy.enroll) return 'not_linked';
  if (subjectLink) return 'identity_linked_elsewhere';
  return null;
}

const ERROR_MESSAGES: Record<string, string> = {
  stale_authentication: 'World ID authentication was not fresh enough for this action.',
  future_authentication: 'World ID returned an implausible authentication time.',
  insufficient_assurance: 'This action needs a stronger World ID credential (Orb).',
  banned: 'This human is suspended from Stryde — the ban follows them across accounts.',
  identity_mismatch: 'A different human approved this request. Only the linked athlete can approve it.',
  identity_linked_elsewhere:
    'This World ID already belongs to another Stryde account. Use "Recover account" instead.',
  wallet_linked_to_other_human: 'This wallet is already linked to a different human.',
  not_linked: 'This World ID is not linked to any Stryde account.',
  issuer_mismatch: 'Unexpected identity issuer.',
};

/** Advances one approval: polls World when due, authorizes, executes at most once. */
export async function advanceApproval(id: string): Promise<Approval> {
  let approval = store.getApproval(id);
  if (!approval) throw new HumanPassError('not_found', 'Approval not found', 404);
  if (approval.status !== 'pending') return approval;

  const now = Date.now();
  if (now > approval.expiresAt) return fail(approval, 'expired', 'The approval request expired.');
  if (now < approval.nextPollAt) return approval;

  const provider = getIdentityProvider();
  if (!provider) return approval;

  const poll = await provider.poll(approval.deviceCode);
  switch (poll.kind) {
    case 'pending':
      return store.updateApproval(id, { nextPollAt: now + approval.pollIntervalSec * 1000 })!;
    case 'slow_down': {
      const interval = approval.pollIntervalSec + 5;
      return store.updateApproval(id, { pollIntervalSec: interval, nextPollAt: now + interval * 1000 })!;
    }
    case 'denied':
      return fail(approval, 'denied', poll.description || 'The request was declined in World App.');
    case 'expired':
      return fail(approval, 'expired', 'The approval request expired.');
    case 'error':
      return fail(approval, 'failed', poll.description);
    case 'success':
      break;
  }

  let identity: ValidatedIdentity;
  try {
    identity = await provider.validate(poll.idToken);
  } catch (error) {
    return fail(approval, 'failed', `ID token validation failed: ${(error as Error).message}`);
  }

  approval = store.updateApproval(id, {
    authTime: identity.authTime,
    acr: identity.acr,
    amr: identity.amr,
    sub: identity.sub,
  })!;

  const denial = authorizeIdentity(approval, identity);
  if (denial) return fail(approval, 'denied', ERROR_MESSAGES[denial] ?? denial);

  // Single use: flip to executing before any side effect runs.
  const fresh = store.getApproval(id);
  if (!fresh || fresh.status !== 'pending') return fresh ?? approval;
  store.updateApproval(id, { status: 'executing' });

  try {
    const result = await ACTIONS[approval.action]!.execute({
      wallet: approval.wallet as `0x${string}`,
      identity,
      params: approval.params,
      approval,
    });
    return store.updateApproval(id, { status: 'completed', result })!;
  } catch (error) {
    const message =
      error instanceof HumanPassError ? error.message : `Action failed: ${(error as Error).message}`;
    return fail(approval, 'failed', message);
  }
}

export function cancelApproval(id: string, wallet: string): Approval {
  const approval = store.getApproval(id);
  if (!approval || approval.wallet.toLowerCase() !== wallet.toLowerCase()) {
    throw new HumanPassError('not_found', 'Approval not found', 404);
  }
  if (approval.status !== 'pending') return approval;
  return fail(approval, 'cancelled', 'You declined this request in Stryde.');
}

/**
 * Agent tokens are shown once, and only to the client that created the
 * approval (proven by its client secret): strip them after the first read.
 */
export function consumeOneTimeSecrets(
  approval: Approval,
  clientSecret: string | undefined
): Record<string, unknown> | null {
  if (approval.status !== 'completed' || !approval.result || !('token' in approval.result)) {
    return approval.result;
  }
  const { token, ...rest } = approval.result;
  const holdsSecret =
    Boolean(clientSecret && approval.clientSecretHash) && hashToken(clientSecret!) === approval.clientSecretHash;
  if (!holdsSecret) return rest;
  store.updateApproval(approval.id, { result: { ...rest, tokenDelivered: true } });
  return { ...rest, token };
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_PROOF_MAX_AGE_MS = 5 * 60 * 1000;

/** What the app signs to prove it holds `wallet` before any /human call. */
export function humanSessionMessage(wallet: string, issuedAt: number): string {
  return `Stryde Coach session\nwallet:${wallet.toLowerCase()}\nissued:${issuedAt}`;
}

/**
 * Trades a wallet signature for a session token. Without it, anyone could link their
 * World ID to someone else's wallet, or read and revoke that athlete's agents.
 */
export async function openHumanSession(input: {
  wallet?: unknown;
  issuedAt?: unknown;
  signature?: unknown;
}): Promise<{ token: string; wallet: string; expiresAt: number }> {
  const { wallet, issuedAt, signature } = input;
  if (typeof wallet !== 'string' || !HEX_ADDRESS_RE.test(wallet)) {
    throw new HumanPassError('bad_wallet', 'wallet must be an address');
  }
  if (typeof issuedAt !== 'number' || Math.abs(Date.now() - issuedAt) > SESSION_PROOF_MAX_AGE_MS) {
    throw new HumanPassError('stale_proof', 'issuedAt must be within 5 minutes of now');
  }
  if (typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new HumanPassError('bad_signature', 'signature required');
  }
  // ERC-1271/6492 aware, so Privy smart wallets work before they are deployed.
  const valid = await getRelayerPublicClient()
    .verifyMessage({
      address: wallet as `0x${string}`,
      message: humanSessionMessage(wallet, issuedAt),
      signature: signature as `0x${string}`,
    })
    .catch(() => false);
  if (!valid) throw new HumanPassError('bad_signature', 'Wallet signature is invalid', 401);

  const token = `stryde_human_${randomBytes(24).toString('base64url')}`;
  const expiresAt = Date.now() + SESSION_TTL_MS;
  store.addHumanSession({ tokenHash: hashToken(token), wallet, expiresAt });
  return { token, wallet, expiresAt };
}

/** The wallet a /human request proved it holds, or null. */
export function resolveHumanSession(authorization: string | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(stryde_human_[A-Za-z0-9_-]+)$/);
  if (!match) return null;
  return store.findHumanSession(hashToken(match[1]!))?.wallet ?? null;
}

export function resolveAgentToken(authorization: string | undefined) {
  const match = authorization?.match(/^Bearer\s+(stryde_agent_[A-Za-z0-9_-]+)$/);
  if (!match) return null;
  const grant = store.findAgentGrantByTokenHash(hashToken(match[1]!));
  if (!grant) return null;
  const link = store.findLinkBySubject(grant.iss, grant.sub);
  // A recovered account moves the human to a new wallet; old grants die with the old wallet.
  if (!link || link.wallet.toLowerCase() !== grant.wallet.toLowerCase()) return null;
  return grant;
}

export function humanStatus(wallet: string) {
  const link = store.findLinkByWallet(wallet);
  const ban = link ? store.findBan(link.iss, link.sub) : undefined;
  return {
    linked: Boolean(link),
    linkedAt: link?.linkedAt ?? null,
    banned: Boolean(ban),
    banReason: ban?.reason ?? null,
    agentGrants: store.listAgentGrants(wallet).map((g) => ({
      id: g.id,
      label: g.label,
      createdAt: g.createdAt,
      revokedAt: g.revokedAt,
    })),
  };
}

export function isWalletBanned(wallet: string): boolean {
  return store.listBannedWallets().includes(wallet.toLowerCase());
}

export function banHuman(input: { wallet?: string; sub?: string; reason: string }): { sub: string } {
  const link = input.wallet
    ? store.findLinkByWallet(input.wallet)
    : input.sub
      ? store.findLinkBySubject(expectedIssuer(), input.sub)
      : undefined;
  if (!link) throw new HumanPassError('not_linked', 'No World ID is linked to that athlete.', 404);
  store.addBan({ iss: link.iss, sub: link.sub, reason: input.reason, bannedAt: Date.now() });
  return { sub: link.sub };
}

export function unbanHuman(wallet: string): boolean {
  const link = store.findLinkByWallet(wallet);
  return link ? store.removeBan(link.iss, link.sub) : false;
}
