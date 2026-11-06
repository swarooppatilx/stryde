import { type Expression, eq } from '@arkiv-network/sdk/query';
import { addr, bytes, defineSchema, str, u64 } from '@arkiv-network/sdk/schema';
import type { Address } from './address.js';
import {
  type ArkivPublicClient,
  type ArkivWalletClient,
  createEntityStore,
  type EntityLike,
  secondsAttribute,
  walletAttribute,
} from './arkivEntityStore.js';
import type { CommentLikePage, CommentLikeRecord, CommentLikeStore } from './commentLikes.js';
import { type Bytes32, isBytes32 } from './hex.js';

/** A comment id is a 32-byte hash held as lowercase hex text (66 characters, inside the 128-byte `str` limit). */
export const CommentLikeSchema = defineSchema('comment_like', {
  liker: addr().indexed(),
  comment_id: str().indexed(),
  liked_at: u64().indexed(),
  data: bytes(),
});

export function commentLikeAttributes(liker: Address, commentId: Bytes32, likedAt: number) {
  return {
    liker: addr(liker),
    comment_id: str(commentId.toLowerCase()),
    liked_at: u64(likedAt),
  };
}

export function commentLikeFromEntity(entity: EntityLike): CommentLikeRecord | null {
  const liker = walletAttribute(entity, 'liker');
  const commentValue = entity.attributes.comment_id;
  const commentId = commentValue?.type === 'str' ? commentValue.value : null;
  if (!liker) return null;
  if (!isBytes32(commentId)) return null;
  return {
    entityKey: entity.key,
    liker,
    commentId: commentId.toLowerCase() as Bytes32,
    likedAt: secondsAttribute(entity, 'liked_at'),
  };
}

/** Comment likes as Arkiv entities written by this server's signer; only that signer's entities count. */
export function createArkivCommentLikeStore(
  publicClient: ArkivPublicClient,
  walletClient: ArkivWalletClient
): CommentLikeStore {
  const entities = createEntityStore(publicClient, walletClient, CommentLikeSchema);

  const page = async (...filters: Expression[]): Promise<CommentLikePage> => {
    const result = await entities.query(filters);
    return {
      entries: result.entities
        .map((entity) => commentLikeFromEntity(entity))
        .filter((record): record is CommentLikeRecord => record !== null),
      truncated: result.truncated,
    };
  };

  const forComment = (commentId: Bytes32) => eq('comment_id', str(commentId.toLowerCase()));

  return {
    async find(liker, commentId) {
      const { entries } = await page(eq('liker', addr(liker)), forComment(commentId));
      return entries[0] ?? null;
    },

    async create({ liker, commentId, signature, deadline, likedAt }) {
      const entityKey = await entities.create(
        { signature, deadline },
        commentLikeAttributes(liker, commentId, likedAt)
      );
      return { entityKey, liker, commentId, likedAt };
    },

    remove: (entityKey) => entities.remove(entityKey),
    likers: (commentId) => page(forComment(commentId)),
    removeAllFor: (liker) => entities.removeAll([eq('liker', addr(liker))]),
  };
}
