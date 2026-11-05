import { isHex } from 'viem';
import type { FollowIntent } from './follows.js';

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
    domain: { name: 'Stryde Social', version: '1', chainId },
    types: FOLLOW_TYPES,
    primaryType: 'Follow' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}

interface TypedDataVerifier {
  verifyTypedData(params: {
    address: `0x${string}`;
    signature: `0x${string}`;
    domain: ReturnType<typeof followTypedData>['domain'];
    types: typeof FOLLOW_TYPES;
    primaryType: 'Follow';
    message: ReturnType<typeof followTypedData>['message'];
  }): Promise<boolean>;
}

/** Checks the follower really signed this intent. The chain client also accepts smart-wallet (ERC-1271) signatures. */
export function createFollowVerifier(client: TypedDataVerifier, chainId: number) {
  return async (intent: FollowIntent, signature: string): Promise<boolean> => {
    // Not even hex, so not a signature: say so. Anything else that fails (an RPC outage) must surface.
    if (!isHex(signature)) return false;
    return client.verifyTypedData({
      address: intent.follower,
      signature,
      ...followTypedData(intent, chainId),
    });
  };
}
