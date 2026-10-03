import { services } from '@repo/shared';
import { getCurrentUserId } from '@/constants/currentUser';
import { queuedWrite } from '@/services/wallet';
import { sameAddress } from '@/utils/address';
import { logger } from '@/utils/logger';
import { activityKey, applyCommentLikes, withCommentLike } from '@/utils/socialFeed';
import type { SocialActivity } from '@/utils/socialSelectors';
import { Toast } from '@/utils/toast';

/** The likes service answers for at most this many comments per request. */
const COMMENT_LIKES_PER_REQUEST = 100;
const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;

/** The part of the social state the comment-like actions read and write. */
export interface CommentLikeSlice {
  activities: Record<string, SocialActivity>;
}

type SetSlice = (
  update: (state: CommentLikeSlice) => Partial<CommentLikeSlice> | CommentLikeSlice
) => void;

export function createCommentLikeActions(set: SetSlice, get: () => CommentLikeSlice) {
  return {
    /** Likes or unlikes a comment at once on screen, then records it; undoes it if that fails. */
    toggleCommentLike: async (activityId: string, commentId: string) => {
      const me = getCurrentUserId();
      const key = activityKey(get().activities, activityId);
      const comment = get().activities[key]?.comments.find((c) => c.id === commentId);
      if (!comment) return;
      const like = !(comment.likedBy ?? []).some((id) => sameAddress(id, me));
      set((state) => ({
        activities: withCommentLike(state.activities, activityId, commentId, me, like),
      }));

      // A comment still being posted has no chain id yet; its like stays on this device.
      if (!BYTES32_PATTERN.test(commentId)) return;
      try {
        const sent = await queuedWrite((wallet) =>
          services.commentLikes.setCommentLike(wallet, commentId as `0x${string}`, like)
        );
        if (sent === null) throw new Error('Wallet is not ready yet');
      } catch (e) {
        logger.warn('[Social] Comment like failed, rolling back:', e);
        Toast.fail(like ? "Couldn't like that comment" : "Couldn't unlike that comment", 2);
        set((state) => ({
          activities: withCommentLike(state.activities, activityId, commentId, me, !like),
        }));
      }
    },

    /** Replaces each comment's likes with what the likes service reports. */
    loadCommentLikes: async () => {
      const ids = [
        ...new Set(
          Object.values(get().activities).flatMap((a) =>
            a.comments.map((c) => c.id).filter((id) => BYTES32_PATTERN.test(id))
          )
        ),
      ];
      try {
        for (let i = 0; i < ids.length; i += COMMENT_LIKES_PER_REQUEST) {
          const { likes } = await services.commentLikes.getCommentLikes(
            ids.slice(i, i + COMMENT_LIKES_PER_REQUEST) as `0x${string}`[]
          );
          set((state) => ({ activities: applyCommentLikes(state.activities, likes) }));
        }
      } catch (e) {
        // Best-effort: keep the likes already shown.
        logger.warn('[Social] Failed to load comment likes:', e);
      }
    },
  };
}
