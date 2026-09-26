import { isHex } from 'viem';
import type { PushIntent } from './pushTokens.js';

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
    domain: { name: 'Stryde Social', version: '1', chainId },
    types: PUSH_TYPES,
    primaryType: 'PushToken' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}

interface TypedDataVerifier {
  verifyTypedData(params: {
    address: `0x${string}`;
    signature: `0x${string}`;
    domain: ReturnType<typeof pushTypedData>['domain'];
    types: typeof PUSH_TYPES;
    primaryType: 'PushToken';
    message: ReturnType<typeof pushTypedData>['message'];
  }): Promise<boolean>;
}

/** Checks the owner really signed this exact registration. The chain client also accepts smart-wallet (ERC-1271) signatures. */
export function createPushVerifier(client: TypedDataVerifier, chainId: number) {
  return async (intent: PushIntent, signature: string): Promise<boolean> => {
    if (!isHex(signature)) return false;
    return client.verifyTypedData({
      address: intent.owner,
      signature,
      ...pushTypedData(intent, chainId),
    });
  };
}
