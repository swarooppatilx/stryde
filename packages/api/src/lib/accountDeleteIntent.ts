import type { AccountDeleteIntent } from './accountDelete.js';
import { createIntentVerifier, socialDomain } from './signedIntent.js';

/** Must match packages/shared/src/services/accountDeleteIntent.ts, which the app signs with. */
const ACCOUNT_DELETE_TYPES = {
  AccountDelete: [
    { name: 'owner', type: 'address' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function accountDeleteTypedData(intent: AccountDeleteIntent, chainId: number) {
  return {
    domain: socialDomain(chainId),
    types: ACCOUNT_DELETE_TYPES,
    primaryType: 'AccountDelete' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}

/** Checks the owner really signed this exact intent (see `createIntentVerifier`). */
export const createAccountDeleteVerifier = createIntentVerifier(
  accountDeleteTypedData,
  (intent: AccountDeleteIntent) => intent.owner
);
