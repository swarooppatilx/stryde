import type { PushIntent } from './pushTokens.js';
import { createIntentVerifier, socialDomain } from './signedIntent.js';

/** Must match packages/shared/src/services/pushIntent.ts, which the app signs with. */
const PUSH_TYPES = {
  PushToken: [
    { name: 'owner', type: 'address' },
    { name: 'token', type: 'string' },
    { name: 'platform', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function pushTypedData(intent: PushIntent, chainId: number) {
  return {
    domain: socialDomain(chainId),
    types: PUSH_TYPES,
    primaryType: 'PushToken' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}

/** Checks the owner really signed this exact intent (see `createIntentVerifier`). */
export const createPushVerifier = createIntentVerifier(
  pushTypedData,
  (intent: PushIntent) => intent.owner
);
