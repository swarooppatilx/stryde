import { services } from '@repo/shared';
import {
  getOutbox,
  registerOutboxHandler,
  registerRejectionHandler,
} from '@/backends/outbox/appOutbox';
import { RejectedError } from '@/backends/outbox/outbox';
import { getCurrentUserId } from '@/constants/currentUser';
import { SET_FOLLOW } from '@/constants/outboxKinds';
import { queuedWrite } from '@/services/wallet';
import { usePushPrimerStore } from '@/stores/pushPrimerStore';
import { sameAddress } from '@/utils/address';
import { isApiRefusal } from '@/utils/isApiRefusal';
import { logger } from '@/utils/logger';
import type { SocialUser } from '@/utils/socialSelectors';
import { Toast } from '@/utils/toast';

/** The part of the social state the follow actions read and write. */
export interface FollowSlice {
  users: Record<string, SocialUser>;
  following: Set<string>;
  myFollowerCount: number;
  followerEntries: { address: string; followedAt: number }[];
}

type SetSlice = (
  update: Partial<FollowSlice> | ((state: FollowSlice) => Partial<FollowSlice> | FollowSlice)
) => void;

/** The state after `key` is followed (or not): the follow set, and that athlete's follower count. */
function withFollow(
  state: Pick<FollowSlice, 'following' | 'users'>,
  key: string,
  follow: boolean
): Pick<FollowSlice, 'following'> & Partial<Pick<FollowSlice, 'users'>> {
  const following = new Set(state.following);
  if (follow) following.add(key);
  else following.delete(key);

  const user = state.users[key];
  if (!user) return { following };
  const followers = Math.max(0, user.followers + (follow ? 1 : -1));
  return { following, users: { ...state.users, [key]: { ...user, followers } } };
}

const followKey = (athlete: string) => `follow:${athlete}`;

interface FollowIntent {
  athlete: string;
  follow: boolean;
}

export function createFollowActions(set: SetSlice, get: () => FollowSlice) {
  // How a follow intent reaches the server (safe to repeat: it sets a state), and how to undo it
  // when the server refuses for good.
  registerOutboxHandler(SET_FOLLOW, async (payload) => {
    const { athlete, follow } = payload as FollowIntent;
    try {
      const sent = await queuedWrite((wallet) =>
        services.follows.setFollowing(wallet, athlete as `0x${string}`, follow)
      );
      if (sent === null) throw new Error('Wallet is not ready yet');
    } catch (error) {
      if (isApiRefusal(error)) {
        throw new RejectedError(error instanceof Error ? error.message : 'Refused');
      }
      throw error;
    }
  });
  registerRejectionHandler(SET_FOLLOW, (entry) => {
    const { athlete, follow } = entry.payload as FollowIntent;
    set((state) => withFollow(state, athlete, !follow));
    Toast.fail(follow ? "Couldn't follow" : "Couldn't unfollow", 2);
  });

  return {
    /** Follows or unfollows at once on screen; the outbox records it on the server whenever it can. */
    toggleFollow: async (userId: string) => {
      const key = userId.toLowerCase();
      // A self-follow is not a graph edge, but the registry would accept it and the
      // athlete would pay for the write. Refuse before the optimistic flip, so the
      // button can't leave a phantom "Following" state either.
      if (sameAddress(getCurrentUserId(), key)) return;
      const follow = !get().following.has(key);
      set((state) => withFollow(state, key, follow));
      if (follow) usePushPrimerStore.getState().noteMoment();

      const intent: FollowIntent = { athlete: key, follow };
      await getOutbox().enqueue({ kind: SET_FOLLOW, key: followKey(key), payload: intent });
      void getOutbox().drain();
    },

    /** Replaces the local follow set with the server's, and counts the viewer's followers. */
    syncFollowing: async (address: `0x${string}`) => {
      try {
        const [following, followers] = await Promise.all([
          services.follows.getFollowing(address),
          services.follows.getFollowers(address),
        ]);
        set({
          following: new Set(following.addresses.map((a) => a.toLowerCase())),
          myFollowerCount: followers.addresses.length,
          followerEntries: followers.entries,
        });
      } catch (e) {
        logger.warn('[Social] Failed to load follow graph:', e);
      }
    },

    /** Fills in another athlete's follower and following counts. */
    loadFollowStats: async (userId: `0x${string}`) => {
      const key = userId.toLowerCase();
      try {
        const [following, followers] = await Promise.all([
          services.follows.getFollowing(userId),
          services.follows.getFollowers(userId),
        ]);
        set((state) => {
          const user = state.users[key];
          if (!user) return state;
          return {
            users: {
              ...state.users,
              [key]: {
                ...user,
                following: following.addresses.length,
                followers: followers.addresses.length,
              },
            },
          };
        });
      } catch (e) {
        logger.warn('[Social] Failed to load follow counts:', e);
      }
    },

    isFollowing: (userId: string) => get().following.has(userId.toLowerCase()),
  };
}
