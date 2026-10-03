import { services } from '@repo/shared';
import {
  getOutbox,
  registerOutboxHandler,
  registerRejectionHandler,
} from '@/backends/outbox/appOutbox';
import { RejectedError } from '@/backends/outbox/outbox';
import { getCurrentUserId } from '@/constants/currentUser';
import { getPlatform } from '@/platform';
import { queuedWrite } from '@/services/wallet';
import { useActivityStore } from '@/stores/activityStore';
import { sameAddress } from '@/utils/address';
import { isContractRevert, revertName } from '@/utils/isContractRevert';
import { activityKey } from '@/utils/socialFeed';
import type { SocialActivity, SocialComment } from '@/utils/socialSelectors';
import { Toast } from '@/utils/toast';

/** Resolves a feed item's chain key (lowercase activity hash) or local record id to the key the record is stored under. */
function resolveOnchainActivityId(activity: SocialActivity): bigint | undefined {
  if (activity.activityId != null) return BigInt(activity.activityId);
  // A just-recorded activity isn't in the chain-synced feed yet; its id was
  // stored on the local record when recordActivity confirmed.
  const local = useActivityStore
    .getState()
    .activities.find((a) => a.id === activity.id || a.activityHash === activity.activityHash);
  return local?.onchainActivityId ? BigInt(local.onchainActivityId) : undefined;
}

/** The part of the social state kudos and comments read and write. */
export interface PostSlice {
  activities: Record<string, SocialActivity>;
  currentUserKudos: Set<string>;
}

type SetSlice = (update: Partial<PostSlice> | ((state: PostSlice) => Partial<PostSlice>)) => void;

const SET_KUDOS = 'setKudos';
const kudosKey = (activityKey: string) => `kudos:${activityKey}`;
const ADD_COMMENT = 'addComment';

/** Everything needed to post a comment, fixed when it is written so a retry sends identical content. */
interface CommentIntent {
  activityKey: string;
  commentId: string;
  text: string;
  createdAt: string;
}

interface KudosIntent {
  activityKey: string;
  wanted: boolean;
}

/** The feed's state for one activity with the current user's kudos set (or not) as wanted. */
function withKudos(state: PostSlice, activityKey: string, wanted: boolean): Partial<PostSlice> {
  const me = getCurrentUserId().toLowerCase();
  const kudos = new Set(state.currentUserKudos);
  if (wanted) kudos.add(activityKey);
  else kudos.delete(activityKey);
  const activity = state.activities[activityKey];
  return {
    currentUserKudos: kudos,
    ...(activity
      ? {
          activities: {
            ...state.activities,
            [activityKey]: {
              ...activity,
              kudos: wanted
                ? [...activity.kudos.filter((id) => !sameAddress(id, me)), me]
                : activity.kudos.filter((id) => !sameAddress(id, me)),
            },
          },
        }
      : {}),
  };
}

export function createPostActions(set: SetSlice, get: () => PostSlice) {
  // How a kudos intent reaches the chain, and how to undo it if the contract refuses it for good.
  registerOutboxHandler(SET_KUDOS, async (payload) => {
    const { activityKey, wanted } = payload as KudosIntent;
    const activity = get().activities[activityKey];
    if (!activity) throw new RejectedError('Activity is no longer in the feed');
    const onchainId = resolveOnchainActivityId(activity);
    if (onchainId === undefined) throw new Error('Activity is not on-chain yet');
    try {
      const sent = await queuedWrite((w) => services.social.setKudos(w, onchainId, wanted));
      if (sent === null) throw new Error('No wallet yet');
    } catch (error) {
      if (isContractRevert(error)) throw new RejectedError('The contract refused the kudos');
      throw error;
    }
  });
  registerRejectionHandler(SET_KUDOS, (entry) => {
    const { activityKey, wanted } = entry.payload as KudosIntent;
    set(withKudos(get(), activityKey, !wanted));
    Toast.fail("Couldn't save kudos", 2);
  });

  registerOutboxHandler(ADD_COMMENT, async (payload) => {
    const { activityKey, commentId, text, createdAt } = payload as CommentIntent;
    const activity = get().activities[activityKey];
    if (!activity) throw new RejectedError('Activity is no longer in the feed');
    const onchainId = resolveOnchainActivityId(activity);
    if (onchainId === undefined) throw new Error('Activity is not on-chain yet');
    // The document is fixed by the intent, so a retry pins identical content (the same cid).
    const { cid } = await services.social.uploadCommentToIpfs({
      activityHash: activity.activityHash ?? '',
      commentId,
      author: getCurrentUserId(),
      text,
      createdAt,
    });
    try {
      const sent = await queuedWrite((w) =>
        services.social.addComment(w, onchainId, commentId as `0x${string}`, cid)
      );
      if (sent === null) throw new Error('No wallet yet');
    } catch (error) {
      const name = revertName(error);
      // The comment id is used once, so "duplicate" means an earlier attempt already went through.
      if (name === 'DuplicateComment') return;
      if (name !== null)
        throw new RejectedError(`The contract refused the comment (${name || 'revert'})`);
      throw error;
    }
  });
  registerRejectionHandler(ADD_COMMENT, (entry) => {
    const { activityKey, commentId } = entry.payload as CommentIntent;
    const activity = get().activities[activityKey];
    if (activity) {
      set({
        activities: {
          ...get().activities,
          [activityKey]: {
            ...activity,
            comments: activity.comments.filter((c) => c.id !== commentId),
          },
        },
      });
    }
    Toast.fail("Couldn't post comment", 2);
  });

  return {
    toggleKudos: async (activityId: string) => {
      const state = get();
      const key = activityKey(state.activities, activityId);
      const activity = state.activities[key];
      const hasKudos = activity
        ? activity.kudos.some((id) => sameAddress(id, getCurrentUserId()))
        : state.currentUserKudos.has(key);
      const wanted = !hasKudos;

      // Local first: the change shows at once and the outbox tells the chain whenever it can.
      set(withKudos(state, key, wanted));
      const intent: KudosIntent = { activityKey: key, wanted };
      await getOutbox().enqueue({ kind: SET_KUDOS, key: kudosKey(key), payload: intent });
      void getOutbox().drain();
    },

    addComment: async (activityId: string, text: string) => {
      const state = get();
      const key = activityKey(state.activities, activityId);
      const currentUserId = getCurrentUserId();
      const activity = state.activities[key];
      if (!activity) return;

      const commentIdBytes = services.social.computeCommentId(
        resolveOnchainActivityId(activity) ?? 0n,
        currentUserId as `0x${string}`,
        text,
        BigInt(Math.floor(Date.now() / 1000)),
        // Posting "nice" twice in one second is two comments, not one.
        getPlatform().ids.next()
      );

      const comment: SocialComment = {
        id: commentIdBytes,
        userId: currentUserId,
        text,
        createdAt: new Date(),
        likedBy: [],
      };

      set({
        activities: {
          ...state.activities,
          [key]: { ...activity, comments: [...activity.comments, comment] },
        },
      });

      // Local first: the comment is already on screen; the outbox uploads and posts it when it can.
      const intent: CommentIntent = {
        activityKey: key,
        commentId: commentIdBytes,
        text,
        createdAt: comment.createdAt.toISOString(),
      };
      await getOutbox().enqueue({
        kind: ADD_COMMENT,
        key: `comment:${commentIdBytes}`,
        payload: intent,
      });
      void getOutbox().drain();
    },
  };
}
