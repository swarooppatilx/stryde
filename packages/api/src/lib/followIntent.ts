import type { FollowIntent } from './follows.js';
import { createIntentVerifier, socialDomain } from './signedIntent.js';

/** Must match packages/shared/src/services/followIntent.ts, which the app signs with. */
const FOLLOW_TYPES = {
  Follow: [
    { name: 'follower', type: 'address' },
    { name: 'followee', type: 'address' },
    { name: 'action', type: 'string' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function followTypedData(intent: FollowIntent, chainId: number) {
  return {
    domain: socialDomain(chainId),
    types: FOLLOW_TYPES,
    primaryType: 'Follow' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}

/** Checks the follower really signed this exact intent (see `createIntentVerifier`). */
export const createFollowVerifier = createIntentVerifier(
  followTypedData,
  (intent: FollowIntent) => intent.follower
);
