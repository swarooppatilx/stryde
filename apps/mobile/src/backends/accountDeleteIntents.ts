import { services } from '@repo/shared';
import {
  ACCOUNT_DELETE,
  createAccountDeleteHandler,
  recordDeletionCounts,
} from '@/services/accountDeletion';
import { getActiveWallet } from '@/services/wallet';
import { registerOutboxHandler } from './outbox/appOutbox';

/** Teaches the outbox how an account deletion is signed and sent. */
export function registerAccountDeleteIntents(): void {
  registerOutboxHandler(
    ACCOUNT_DELETE,
    createAccountDeleteHandler({
      wallet: getActiveWallet,
      send: (wallet) => services.account.deleteAccountData(wallet),
      onResult: recordDeletionCounts,
    })
  );
}
