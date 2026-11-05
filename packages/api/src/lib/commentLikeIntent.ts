import { isHex } from 'viem';
import type { CommentLikeIntent } from './commentLikes.js';

/** Must match packages/shared/src/services/commentLikeIntent.ts, which the app signs with. */
const COMMENT_LIKE_TYPES = {
  CommentLike: [
    { name: 'liker', type: 'address' },
    { name: 'commentId', type: 'bytes32' },
    { name: 'action', type: 'string' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function commentLikeTypedData(intent: CommentLikeIntent, chainId: number) {
  return {
    domain: { name: 'Stryde Social', version: '1', chainId },
    types: COMMENT_LIKE_TYPES,
    primaryType: 'CommentLike' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}

interface TypedDataVerifier {
  verifyTypedData(params: {
    address: `0x${string}`;
    signature: `0x${string}`;
    domain: ReturnType<typeof commentLikeTypedData>['domain'];
    types: typeof COMMENT_LIKE_TYPES;
    primaryType: 'CommentLike';
    message: ReturnType<typeof commentLikeTypedData>['message'];
  }): Promise<boolean>;
}

/** Checks the liker really signed this intent. The chain client also accepts smart-wallet (ERC-1271) signatures. */
export function createCommentLikeVerifier(client: TypedDataVerifier, chainId: number) {
  return async (intent: CommentLikeIntent, signature: string): Promise<boolean> => {
    // Not even hex, so not a signature: say so. Anything else that fails (an RPC outage) must surface.
    if (!isHex(signature)) return false;
    return client.verifyTypedData({
      address: intent.liker,
      signature,
      ...commentLikeTypedData(intent, chainId),
    });
  };
}
