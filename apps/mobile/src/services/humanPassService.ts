import * as Linking from 'expo-linking';
import { AppState } from 'react-native';
import type { WalletClient } from 'viem';
import { apiFetch, StrydeApiError } from './strydeApi';

/** The athlete's wallet: /human calls prove they hold it with a signed session. */
export interface HumanAuth {
  wallet: WalletClient;
  address: `0x${string}`;
}

export type HumanAction =
  | 'link_human'
  | 'recover_account'
  | 'issue_agent_token'
  | 'claim_activity_reward';
export type ApprovalStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'denied'
  | 'expired'
  | 'cancelled'
  | 'failed';

export interface Approval {
  id: string;
  action: HumanAction;
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

export interface HumanStatus {
  configured: boolean;
  mode: 'world' | 'mock' | null;
  linked: boolean;
  linkedAt: number | null;
  banned: boolean;
  banReason: string | null;
  agentGrants: Array<{ id: string; label: string; createdAt: number; revokedAt: number | null }>;
}

const POLL_MS = 2_000;
const TERMINAL: ApprovalStatus[] = ['completed', 'denied', 'expired', 'cancelled', 'failed'];

export const isTerminal = (status: ApprovalStatus) => TERMINAL.includes(status);

/** Must match humanSessionMessage in packages/api/src/lib/humanPass.ts. */
export function humanSessionMessage(address: string, issuedAt: number): string {
  return `Stryde Coach session\nwallet:${address.toLowerCase()}\nissued:${issuedAt}`;
}

const SESSION_MARGIN_MS = 60_000;
let session: { address: string; token: string; expiresAt: number } | null = null;
let opening: { address: string; promise: Promise<string> } | null = null;

async function openSession({ wallet, address }: HumanAuth): Promise<string> {
  const issuedAt = Date.now();
  const signature = await wallet.signMessage({
    account: wallet.account ?? address,
    message: humanSessionMessage(address, issuedAt),
  });
  const opened = await apiFetch<{ token: string; expiresAt: number }>('/human/session', {
    method: 'POST',
    body: JSON.stringify({ wallet: address, issuedAt, signature }),
  });
  session = { address: address.toLowerCase(), token: opened.token, expiresAt: opened.expiresAt };
  return opened.token;
}

/** One signature per session: concurrent callers share the same in-flight sign-in. */
function sessionToken(auth: HumanAuth): Promise<string> {
  const address = auth.address.toLowerCase();
  if (session?.address === address && session.expiresAt - SESSION_MARGIN_MS > Date.now()) {
    return Promise.resolve(session.token);
  }
  if (opening?.address !== address) {
    const promise: Promise<string> = openSession(auth).finally(() => {
      if (opening?.promise === promise) opening = null;
    });
    opening = { address, promise };
  }
  return opening.promise;
}

async function humanFetch<T>(
  auth: HumanAuth,
  path: string,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {}
): Promise<T> {
  const send = async () =>
    apiFetch<T>(path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${await sessionToken(auth)}` },
    });
  try {
    return await send();
  } catch (error) {
    // The server no longer knows the session (restart or expiry): sign in again, once.
    const code =
      error instanceof StrydeApiError ? (error.body as { code?: string } | null)?.code : null;
    if (code !== 'session_required') throw error;
    session = null;
    return send();
  }
}

export function getHumanStatus(auth: HumanAuth) {
  return humanFetch<HumanStatus>(auth, '/human/status');
}

export function listApprovals(auth: HumanAuth) {
  return humanFetch<{ approvals: Approval[] }>(auth, '/human/approvals');
}

export function getApproval(id: string, auth: HumanAuth, clientSecret?: string) {
  return humanFetch<Approval>(auth, `/human/approvals/${id}`, {
    headers: clientSecret ? { 'X-Approval-Secret': clientSecret } : {},
  });
}

export function cancelApproval(id: string, auth: HumanAuth) {
  return humanFetch<Approval>(auth, `/human/approvals/${id}/cancel`, { method: 'POST' });
}

export function revokeAgent(grantId: string, auth: HumanAuth) {
  return humanFetch<{ revoked: boolean }>(auth, `/human/agents/${grantId}`, { method: 'DELETE' });
}

export function openInWorldApp(approval: Approval) {
  return Linking.openURL(approval.verificationUriComplete);
}

/**
 * Polls an approval until it reaches a terminal state, polling immediately
 * whenever the user returns from World App.
 */
export async function waitForApproval(
  id: string,
  auth: HumanAuth,
  onUpdate?: (approval: Approval) => void,
  options: { clientSecret?: string; signal?: { cancelled: boolean } } = {}
): Promise<Approval> {
  const { clientSecret, signal } = options;
  let wake: (() => void) | null = null;
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') wake?.();
  });
  try {
    for (;;) {
      const approval = await getApproval(id, auth, clientSecret);
      onUpdate?.(approval);
      if (isTerminal(approval.status) || signal?.cancelled) return approval;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, POLL_MS);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      wake = null;
    }
  } finally {
    sub.remove();
  }
}

/** Starts an approval, opens World App and resolves when the human decides. */
export async function requestHumanApproval(
  auth: HumanAuth,
  action: HumanAction,
  params: Record<string, unknown> = {},
  onUpdate?: (approval: Approval) => void
): Promise<Approval> {
  const { clientSecret, ...approval } = await humanFetch<Approval & { clientSecret: string }>(
    auth,
    '/human/approvals',
    { method: 'POST', body: JSON.stringify({ action, params }) }
  );
  onUpdate?.(approval);
  await openInWorldApp(approval).catch(() => undefined);
  return waitForApproval(approval.id, auth, onUpdate, { clientSecret });
}
