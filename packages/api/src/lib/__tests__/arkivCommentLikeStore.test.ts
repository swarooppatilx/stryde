import { describe, expect, it } from 'vitest';
import {
  CommentLikeSchema,
  commentLikeAttributes,
  commentLikeFromEntity,
} from '../arkivCommentLikeStore.js';

const ME = '0xA9e9Bcaa4Fb2BD6C3C770e88eCB085f2E92B10cb';
const COMMENT = `0x${'AB'.repeat(32)}` as const;

describe('commentLikeAttributes', () => {
  it('is its own named schema, and records when the like happened', () => {
    const attributes = commentLikeAttributes(ME, COMMENT, 1_700_000_000);

    expect(CommentLikeSchema.name).toBe('comment_like');
    expect(attributes.liked_at).toMatchObject({ type: 'u64', value: 1_700_000_000n });
  });

  it('stores the same values whatever letter case they arrive in', () => {
    expect(
      commentLikeAttributes(
        ME.toLowerCase() as `0x${string}`,
        COMMENT.toLowerCase() as `0x${string}`,
        1
      )
    ).toEqual(commentLikeAttributes(ME, COMMENT, 1));
  });
});

describe('commentLikeFromEntity', () => {
  const entity = {
    key: '0xkey',
    attributes: {
      liker: { type: 'addr', value: ME },
      comment_id: { type: 'str', value: COMMENT.toLowerCase() },
      liked_at: { type: 'u64', value: 1_700_000_000n },
    },
  };

  it('reads the like back, lowercase', () => {
    expect(commentLikeFromEntity(entity)).toEqual({
      entityKey: '0xkey',
      liker: ME.toLowerCase(),
      commentId: COMMENT.toLowerCase(),
      likedAt: 1_700_000_000,
    });
  });

  it('skips an entity missing the liker or the comment', () => {
    expect(
      commentLikeFromEntity({ key: 'k', attributes: { liker: entity.attributes.liker } })
    ).toBeNull();
    expect(
      commentLikeFromEntity({ key: 'k', attributes: { comment_id: entity.attributes.comment_id } })
    ).toBeNull();
  });

  it('skips an entity whose comment id is not 32 bytes', () => {
    expect(
      commentLikeFromEntity({
        key: 'k',
        attributes: { ...entity.attributes, comment_id: { type: 'str', value: '0x12' } },
      })
    ).toBeNull();
  });
});
