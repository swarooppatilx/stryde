import * as Linking from 'expo-linking';
import { AppState } from 'react-native';
import { apiFetch } from './strydeApi';

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

export function getHumanStatus(wallet: string) {
  return apiFetch<HumanStatus>(`/human/status?wallet=${wallet}`);
}

export function listApprovals(wallet: string) {
  return apiFetch<{ approvals: Approval[] }>(`/human/approvals?wallet=${wallet}`);
}

export function getApproval(id: string, wallet: string, clientSecret?: string) {
  return apiFetch<Approval>(`/human/approvals/${id}?wallet=${wallet}`, {
    headers: clientSecret ? { 'X-Approval-Secret': clientSecret } : {},
  });
}

export function cancelApproval(id: string, wallet: string) {
  return apiFetch<Approval>(`/human/approvals/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  });
}

export function revokeAgent(grantId: string, wallet: string) {
  return apiFetch<{ revoked: boolean }>(`/human/agents/${grantId}?wallet=${wallet}`, {
    method: 'DELETE',
  });
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
  wallet: string,
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
      const approval = await getApproval(id, wallet, clientSecret);
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
  wallet: string,
  action: HumanAction,
  params: Record<string, unknown> = {},
  onUpdate?: (approval: Approval) => void
): Promise<Approval> {
  const { clientSecret, ...approval } = await apiFetch<Approval & { clientSecret: string }>(
    '/human/approvals',
    {
      method: 'POST',
      body: JSON.stringify({ wallet, action, params }),
    }
  );
  onUpdate?.(approval);
  await openInWorldApp(approval).catch(() => undefined);
  return waitForApproval(approval.id, wallet, onUpdate, { clientSecret });
}
