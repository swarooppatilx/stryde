import type { services } from '@repo/shared';
import type { WalletClient } from 'viem';
import type { Handler, Outbox } from '@/backends/outbox/outbox';
import { refuseApiError } from '@/services/refusals';

export const ACCOUNT_DELETE = 'deleteAccountData';
/** One slot: asking twice leaves one request waiting. */
export const ACCOUNT_DELETE_KEY = 'account:delete';

type Counts = services.account.AccountDeleteCounts;

export interface AccountDeleteDeps {
  wallet(): WalletClient | null;
  send(wallet: WalletClient): Promise<{ deleted: boolean; counts: Counts }>;
  onResult(counts: Counts): void;
}

/** How the request reaches the server. Safe to repeat: removing what is already gone removes nothing. */
export function createAccountDeleteHandler(deps: AccountDeleteDeps): Handler {
  return async () => {
    const wallet = deps.wallet();
    if (!wallet) throw new Error('No wallet yet');
    try {
      const result = await deps.send(wallet);
      deps.onResult(result.counts);
    } catch (error) {
      refuseApiError(error);
    }
  };
}

/** What the server last said it removed, kept until the screen has shown it. */
let lastCounts: Counts | null = null;
export const recordDeletionCounts = (counts: Counts) => {
  lastCounts = counts;
};
export function takeDeletionCounts(): Counts | null {
  const counts = lastCounts;
  lastCounts = null;
  return counts;
}

export type DeletionOutcome = 'sent' | 'queued' | 'refused';

/** Files the request and tries to send it now; if the phone is offline it stays queued. */
export async function requestAccountDeletion(
  outbox: Pick<Outbox, 'enqueue' | 'drain' | 'statusOf' | 'consumeRejection'>
): Promise<DeletionOutcome> {
  await outbox.enqueue({ kind: ACCOUNT_DELETE, payload: {}, key: ACCOUNT_DELETE_KEY });
  await outbox.drain();
  if (outbox.statusOf(ACCOUNT_DELETE_KEY) !== undefined) return 'queued';
  return outbox.consumeRejection(ACCOUNT_DELETE_KEY) ? 'refused' : 'sent';
}
