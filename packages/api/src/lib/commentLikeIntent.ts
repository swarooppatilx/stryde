import type { CommentLikeIntent } from './commentLikes.js';
import { createIntentVerifier, socialDomain } from './signedIntent.js';

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
    domain: socialDomain(chainId),
    types: COMMENT_LIKE_TYPES,
    primaryType: 'CommentLike' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}

/** Checks the liker really signed this exact intent (see `createIntentVerifier`). */
export const createCommentLikeVerifier = createIntentVerifier(
  commentLikeTypedData,
  (intent: CommentLikeIntent) => intent.liker
);
