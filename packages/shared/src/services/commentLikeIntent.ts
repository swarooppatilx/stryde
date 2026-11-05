export const COMMENT_LIKE_INTENT_TTL_SECONDS = 120;

export type CommentLikeAction = 'like' | 'unlike';

export interface CommentLikeIntent {
  liker: `0x${string}`;
  /** The SocialRegistry comment id (bytes32). */
  commentId: `0x${string}`;
  action: CommentLikeAction;
  /** Unix seconds; the server rejects the intent after this. */
  deadline: number;
}

const COMMENT_LIKE_TYPES = {
  CommentLike: [
    { name: 'liker', type: 'address' },
    { name: 'commentId', type: 'bytes32' },
    { name: 'action', type: 'string' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function newCommentLikeIntent(
  fields: Omit<CommentLikeIntent, 'deadline'>,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): CommentLikeIntent {
  return { ...fields, deadline: nowSeconds + COMMENT_LIKE_INTENT_TTL_SECONDS };
}

/** What the wallet signs. The same shape is rebuilt by the API to check the signature. */
export function commentLikeTypedData(intent: CommentLikeIntent, chainId: number) {
  return {
    domain: { name: 'Stryde Social', version: '1', chainId },
    types: COMMENT_LIKE_TYPES,
    primaryType: 'CommentLike' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}
