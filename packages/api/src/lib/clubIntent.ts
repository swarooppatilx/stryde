import { isHex } from 'viem';
import type { ClubIntent } from './clubs.js';

/** Must match packages/shared/src/services/clubIntent.ts, which the app signs with. */
const CLUB_TYPES = {
  ClubAction: [
    { name: 'actor', type: 'address' },
    { name: 'clubId', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'target', type: 'string' },
    { name: 'data', type: 'string' },
    { name: 'clientId', type: 'string' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function clubTypedData(intent: ClubIntent, chainId: number) {
  return {
    domain: { name: 'Stryde Clubs', version: '1', chainId },
    types: CLUB_TYPES,
    primaryType: 'ClubAction' as const,
    message: {
      actor: intent.actor,
      clubId: intent.clubId,
      action: intent.action,
      target: intent.target,
      data: intent.data,
      clientId: intent.clientId,
      deadline: BigInt(intent.deadline),
    },
  };
}

interface TypedDataVerifier {
  verifyTypedData(params: {
    address: `0x${string}`;
    signature: `0x${string}`;
    domain: ReturnType<typeof clubTypedData>['domain'];
    types: typeof CLUB_TYPES;
    primaryType: 'ClubAction';
    message: ReturnType<typeof clubTypedData>['message'];
  }): Promise<boolean>;
}

/** Checks the actor really signed this exact action; smart-wallet (ERC-1271) signatures included. */
export function createClubVerifier(client: TypedDataVerifier, chainId: number) {
  return async (intent: ClubIntent, signature: string): Promise<boolean> => {
    if (!isHex(signature)) return false;
    return client.verifyTypedData({
      address: intent.actor,
      signature,
      ...clubTypedData(intent, chainId),
    });
  };
}
