import { services } from '@repo/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getCurrentUserId } from '@/constants/currentUser';
import { useActivityStore } from '@/stores/activityStore';
import { sameAddress } from '@/utils/address';
import { ipfsToHttpUrl } from '@/utils/ipfsUrl';
import { logger } from '@/utils/logger';
import { activityKey, feedFromChain, mergeLocalActivities } from '@/utils/socialFeed';
import { type SocialActivity, type SocialUser, visibleActivities } from '@/utils/socialSelectors';

export {
  resolveUser,
  type SocialActivity,
  type SocialComment,
  type SocialUser,
  searchActivities,
  searchUsers,
  visibleActivities,
} from '@/utils/socialSelectors';
// Re-exported so screens keep importing these from the store.
export { activityKey };

import { mergeAbout } from '@/utils/mergeAbout';
import { chainScopedStorageAdapter, isoDateReviver } from '@/utils/storage';
import { createCommentLikeActions } from './socialCommentLikeActions';
import { createFollowActions } from './socialFollowActions';
import {
  mergeSocialState,
  migrateSocialState,
  toActivityRecord,
  toUserRecord,
} from './socialPersistence';
import { createPostActions } from './socialPostActions';

/** The social API reads at most this many authors per request. */
const ABOUT_BATCH = 100;

interface SocialState {
  users: Record<string, SocialUser>;
  activities: Record<string, SocialActivity>;
  currentUserKudos: Set<string>;
  following: Set<string>;
  /** How many athletes follow the viewer; known after syncFollowing. */
  myFollowerCount: number;
  followerEntries: { address: string; followedAt: number }[];
  /** Bio and location the server has for athletes, so a refreshed athlete list can show them again. */
  about: Record<string, { bio: string; location: string }>;
  /** Epoch ms of the last time the inbox was opened. */
  inboxSeenAt: number;
  /** The first feed load: 'idle' until asked, then 'loading', 'ready' or 'error'. A failed refresh later stays 'ready'. */
  feedStatus: 'idle' | 'loading' | 'ready' | 'error';

  /** Marks everything up to `newestMs` (the newest item's own time) as seen; never moves backwards. */
  markInboxSeen: (newestMs: number) => void;
  /** Resolves false when the athlete list could not be loaded. */
  fetchUsers: () => Promise<boolean>;
  /** Refreshes the feed from the chain. Resolves false (feed untouched) when it couldn't. */
  fetchActivities: () => Promise<boolean>;
  syncLocalActivities: () => void;
  toggleKudos: (activityId: string) => Promise<void>;
  addComment: (activityId: string, text: string) => Promise<void>;
  /** Likes or unlikes a comment at once on screen, then records it; undoes it if that fails. */
  toggleCommentLike: (activityId: string, commentId: string) => Promise<void>;
  /** Replaces each comment's likes with what the likes service reports. */
  loadCommentLikes: () => Promise<void>;
  updateActivity: (activityId: string, updates: Partial<SocialActivity>) => void;
  /** Drops a post from the feed by its hash and/or id (used when the user deletes an activity). */
  removeActivity: (activityHash: string, activityId: string) => void;
  /** Follows or unfollows at once on screen, then records it on the server; undoes it if that fails. */
  toggleFollow: (userId: string) => Promise<void>;
  /** Replaces the local follow set with the server's, and counts the viewer's followers. */
  syncFollowing: (address: `0x${string}`) => Promise<void>;
  /** Fills in another athlete's follower and following counts. */
  loadFollowStats: (userId: `0x${string}`) => Promise<void>;
  /** Fills in athletes' bios and locations from the social API; keeps what it has if that fails. */
  loadAbout: (addresses: readonly string[]) => Promise<void>;
  isFollowing: (userId: string) => boolean;
  getFeed: () => SocialActivity[];
  getSuggestions: () => SocialUser[];
  reset: () => void;
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      users: {},
      activities: {},
      currentUserKudos: new Set<string>(),
      following: new Set<string>(),
      myFollowerCount: 0,
      followerEntries: [],
      about: {},
      inboxSeenAt: 0,
      feedStatus: 'idle',

      markInboxSeen: (newestMs) =>
        set((state) => ({ inboxSeenAt: Math.max(state.inboxSeenAt, newestMs) })),

      syncLocalActivities: () =>
        set((state) => ({
          activities: mergeLocalActivities(
            state.activities,
            useActivityStore.getState().activities
          ),
        })),

      fetchUsers: async () => {
        try {
          const users = await services.profile.getRegisteredUsers();
          const socialUsers: SocialUser[] = users.map((u) => ({
            id: u.wallet,
            username: u.username,
            firstName: '',
            lastName: '',
            gender: 'prefer_not_to_say' as const,
            birthday: null,
            wallet: u.wallet,
            ensName: undefined,
            avatar: u.avatarCid ? ipfsToHttpUrl(u.avatarCid) : undefined,
            isVerified: u.isVerified,
            createdAt: new Date(),
            followers: 0,
            following: 0,
          }));
          set((state) => ({ users: mergeAbout(toUserRecord(socialUsers), state.about) }));
          return true;
        } catch (e) {
          logger.warn('[Social] Failed to fetch users:', e);
          return false;
        }
      },

      fetchActivities: async () => {
        // Only the first load shows a loading or error state; a refresh keeps the feed that is there.
        const first = get().feedStatus !== 'ready';
        if (first) set({ feedStatus: 'loading' });
        try {
          // Activities the user deleted here can't be erased from the chain; don't resurrect them.
          const deleted = new Set(useActivityStore.getState().deletedHashes);
          const chainActivities = (await services.sync.syncAllActivitiesFromChain()).filter(
            (a) => !deleted.has(a.activityHash.toLowerCase())
          );
          let social: Parameters<typeof feedFromChain>[0]['social'] = { kudos: [], comments: [] };
          try {
            social = await services.social.syncSocialFromChain();
          } catch (e) {
            logger.warn('[Social] Failed to sync social data:', e);
          }

          set((state) => {
            const { activities: socialActivities, myKudos } = feedFromChain({
              chain: chainActivities,
              local: useActivityStore.getState().activities,
              existing: state.activities,
              social,
              me: getCurrentUserId(),
            });

            const localKeys = new Set(
              useActivityStore.getState().activities.map((a) => a.activityHash || a.id)
            );
            const localSocial = Object.values(state.activities).filter((a) =>
              localKeys.has(a.activityHash || a.id)
            );
            return {
              currentUserKudos: myKudos,
              activities: mergeLocalActivities(
                toActivityRecord([...localSocial, ...socialActivities]),
                useActivityStore.getState().activities
              ),
            };
          });
          set({ feedStatus: 'ready' });
          void get().loadCommentLikes();
          return true;
        } catch (e) {
          logger.warn('[Social] Failed to fetch activities:', e);
          if (first) set({ feedStatus: 'error' });
          return false;
        }
      },

      ...createPostActions(set, get),

      ...createCommentLikeActions(set, get),

      updateActivity: (activityId: string, updates: Partial<SocialActivity>) =>
        set((state) => {
          const key = activityKey(state.activities, activityId);
          const activity = state.activities[key];
          if (!activity) return state;
          return {
            activities: { ...state.activities, [key]: { ...activity, ...updates } },
          };
        }),

      removeActivity: (activityHash: string, activityId: string) =>
        set((state) => {
          const hash = activityHash.toLowerCase();
          const kept = Object.fromEntries(
            Object.entries(state.activities).filter(
              ([key, a]) =>
                key.toLowerCase() !== hash &&
                a.id !== activityId &&
                (a.activityHash ?? '').toLowerCase() !== hash
            )
          );
          return { activities: kept };
        }),

      ...createFollowActions(set, get),

      loadAbout: async (addresses) => {
        const wanted = [...new Set(addresses.map((a) => a.toLowerCase()))];
        const batches: string[][] = [];
        for (let i = 0; i < wanted.length; i += ABOUT_BATCH)
          batches.push(wanted.slice(i, i + ABOUT_BATCH));
        try {
          const found = await Promise.all(
            batches.map((batch) => services.profileAbout.getAbout(batch as `0x${string}`[]))
          );
          const fetched = Object.assign({}, ...found) as SocialState['about'];
          // Anyone asked about but not returned has no bio (or removed theirs): say so, don't keep a stale one.
          const answered = Object.fromEntries(
            wanted.map((address) => [address, fetched[address] ?? { bio: '', location: '' }])
          );
          set((state) => ({
            about: { ...state.about, ...answered },
            users: mergeAbout(state.users, answered),
          }));
        } catch (e) {
          logger.warn('[Social] Failed to load bios:', e);
        }
      },

      getFeed: () => {
        const viewerId = getCurrentUserId();
        const { activities, following } = get();
        return visibleActivities(Object.values(activities), viewerId, following);
      },

      getSuggestions: () => {
        const { users, activities, following } = get();
        const currentUserId = getCurrentUserId();
        const allActivities = Object.values(activities);
        const followedLowercase = new Set([...following].map((f) => f.toLowerCase()));

        return Object.values(users)
          .filter((u) => {
            const userKey = u.id.toLowerCase();
            return !sameAddress(u.id, currentUserId) && !followedLowercase.has(userKey);
          })
          .map((u) => {
            const userActivities = allActivities.filter((a) => sameAddress(a.userId, u.id));
            let score = 0;

            const lastActivity = userActivities.reduce<{ date: Date } | null>((latest, a) => {
              const created = new Date(a.createdAt);
              if (!latest || created > latest.date) {
                return { date: created };
              }
              return latest;
            }, null);

            if (lastActivity && Date.now() - lastActivity.date.getTime() < 14 * 86400_000) {
              score += 3;
            }

            if (userActivities.some((a) => a.territoryArea > 0)) {
              score += 2;
            }

            if (userActivities.length >= 3) {
              score += 1;
            }

            if (u.avatar) {
              score += 1;
            }

            return {
              user: u,
              score,
              lastActivityDate: lastActivity?.date ?? new Date(0),
            };
          })
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.lastActivityDate.getTime() !== a.lastActivityDate.getTime())
              return b.lastActivityDate.getTime() - a.lastActivityDate.getTime();
            return (a.user.username || '').localeCompare(b.user.username || '');
          })
          .slice(0, 10)
          .map((s) => s.user);
      },

      reset: () =>
        set({
          users: {},
          activities: {},
          currentUserKudos: new Set(),
          following: new Set(),
          myFollowerCount: 0,
          followerEntries: [],
          about: {},
          inboxSeenAt: 0,
          feedStatus: 'idle',
        }),
    }),
    {
      name: 'stryde-social',
      version: 6,
      storage: createJSONStorage(() => chainScopedStorageAdapter, { reviver: isoDateReviver }),
      partialize: (state) => ({
        users: state.users,
        activities: state.activities,
        currentUserKudos: [...state.currentUserKudos],
        following: [...state.following],
        inboxSeenAt: state.inboxSeenAt,
      }),
      merge: mergeSocialState,
      migrate: migrateSocialState,
    }
  )
);
