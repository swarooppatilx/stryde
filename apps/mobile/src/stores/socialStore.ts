import { services } from '@repo/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getCurrentUserId } from '@/constants/config';
import { ipfsToHttpUrl } from '@/services/ipfsService';
import { useActivityStore } from '@/stores/activityStore';
import { useProfileStore } from '@/stores/profileStore';
import type { Activity, User } from '@/types';
import { mergeLocalActivities } from '@/utils/socialFeed';
import { asyncStorageAdapter, isoDateReviver } from '@/utils/storage';

export interface SocialUser extends User {
  bio?: string;
  location?: string;
  followers: number;
  following: number;
}

export interface SocialActivity extends Activity {
  name?: string;
  kudos: string[];
  comments: SocialComment[];
}

/**
 * Privacy is set and persisted purely on the poster's own device — there's no
 * backend/subgraph to propagate it, so a chain-sourced activity with no local
 * record on this device has no privacy data to enforce and defaults to visible.
 * The poster's own device always sees everything they posted regardless.
 */
function isVisibleToViewer(
  activity: SocialActivity,
  viewerId: string,
  following: string[]
): boolean {
  if (activity.userId.toLowerCase() === viewerId.toLowerCase()) return true;
  switch (activity.privacy) {
    case 'only_me':
      return false;
    case 'followers':
      return following.includes(activity.userId);
    default:
      return true;
  }
}

export interface SocialComment {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
  likedBy: string[];
}

interface SocialState {
  users: SocialUser[];
  activities: SocialActivity[];
  currentUserKudos: string[];
  following: string[];

  fetchUsers: () => Promise<void>;
  fetchActivities: () => Promise<void>;
  syncLocalActivities: () => void;
  toggleKudos: (activityId: string) => void;
  addComment: (activityId: string, text: string) => void;
  toggleCommentLike: (activityId: string, commentId: string) => void;
  updateActivity: (activityId: string, updates: Partial<SocialActivity>) => void;
  toggleFollow: (userId: string) => void;
  isFollowing: (userId: string) => boolean;
  getFeed: () => SocialActivity[];
  searchUsers: (query: string) => SocialUser[];
  searchActivities: (query: string) => SocialActivity[];
  getUserById: (id: string) => SocialUser | undefined;
  getUserActivities: (userId: string) => SocialActivity[];
  reset: () => void;
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      users: [],
      activities: [],
      currentUserKudos: [],
      following: [],

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
            createdAt: new Date(),
            followers: 0,
            following: 0,
          }));
          set({ users: socialUsers });
        } catch {
          // ignore — leave users empty
        }
      },

      // There's no backend/subgraph yet, so the cross-user feed is sourced directly
      // from ActivityRecorded logs. Chain-only fields (distance/duration/territoryArea)
      // are filled from the log; richer local-only fields (name/polyline/photos) are
      // filled in when the activity is also present in this device's own activityStore.
      fetchActivities: async () => {
        try {
          const chainActivities = await services.sync.syncAllActivitiesFromChain();
          const localByHash = new Map(
            useActivityStore
              .getState()
              .activities.filter((a) => a.activityHash)
              .map((a) => [a.activityHash, a])
          );

          set((state) => {
            const existingByHash = new Map(
              state.activities.map((a) => [a.activityHash || a.id, a])
            );

            const socialActivities: SocialActivity[] = chainActivities.map((a) => {
              const local = localByHash.get(a.activityHash);
              const existing = existingByHash.get(a.activityHash);

              return {
                id: a.activityHash,
                userId: a.owner,
                name: local?.name,
                activityType: local?.activityType ?? a.activityType,
                distance: local?.distance ?? a.distance,
                duration: local?.duration ?? a.duration,
                polyline: local?.polyline ?? '',
                territory: local?.territory ?? null,
                territoryArea: local?.territoryArea ?? a.territoryArea,
                description: local?.description,
                feel: local?.feel,
                privacy: local?.privacy,
                image: local?.image,
                images: local?.images,
                isManual: local?.isManual,
                activityHash: a.activityHash,
                txHash: local?.txHash,
                createdAt: local?.createdAt ?? new Date(a.timestamp * 1000),
                kudos: existing?.kudos ?? [],
                comments: existing?.comments ?? [],
              };
            });

            // Keep local-only posts and their social interactions across refreshes.
            const localKeys = new Set(
              useActivityStore.getState().activities.map((a) => a.activityHash || a.id)
            );
            const localSocial = state.activities.filter((a) =>
              localKeys.has(a.activityHash || a.id)
            );
            return {
              activities: mergeLocalActivities(
                [...localSocial, ...socialActivities],
                useActivityStore.getState().activities
              ),
            };
          });
        } catch {
          // ignore — leave activities as-is
        }
      },

      toggleKudos: (activityId: string) =>
        set((state) => {
          const hasKudos = state.currentUserKudos.includes(activityId);
          const updatedKudos = hasKudos
            ? state.currentUserKudos.filter((id) => id !== activityId)
            : [...state.currentUserKudos, activityId];

          const updatedActivities = state.activities.map((a) => {
            if (a.id !== activityId) return a;
            const kudos = hasKudos
              ? a.kudos.filter((id) => id !== getCurrentUserId())
              : [...a.kudos, getCurrentUserId()];
            return { ...a, kudos };
          });

          return { currentUserKudos: updatedKudos, activities: updatedActivities };
        }),

      addComment: (activityId: string, text: string) =>
        set((state) => {
          const comment: SocialComment = {
            id: `comment-${Date.now()}`,
            userId: getCurrentUserId(),
            text,
            createdAt: new Date(),
            likedBy: [],
          };

          const updatedActivities = state.activities.map((a) =>
            a.id === activityId ? { ...a, comments: [...a.comments, comment] } : a
          );

          return { activities: updatedActivities };
        }),

      toggleCommentLike: (activityId: string, commentId: string) =>
        set((state) => {
          const updatedActivities = state.activities.map((a) => {
            if (a.id !== activityId) return a;
            return {
              ...a,
              comments: a.comments.map((c) => {
                if (c.id !== commentId) return c;
                const hasLiked = (c.likedBy ?? []).includes(getCurrentUserId());
                return {
                  ...c,
                  likedBy: hasLiked
                    ? (c.likedBy ?? []).filter((id) => id !== getCurrentUserId())
                    : [...(c.likedBy ?? []), getCurrentUserId()],
                };
              }),
            };
          });
          return { activities: updatedActivities };
        }),

      updateActivity: (activityId: string, updates: Partial<SocialActivity>) =>
        set((state) => ({
          activities: state.activities.map((a) => (a.id === activityId ? { ...a, ...updates } : a)),
        })),

      toggleFollow: (userId: string) =>
        set((state) => {
          const isFollowing = state.following.includes(userId);
          const updatedFollowing = isFollowing
            ? state.following.filter((id) => id !== userId)
            : [...state.following, userId];

          const updatedUsers = state.users.map((u) => {
            if (u.id !== userId) return u;
            return {
              ...u,
              followers: isFollowing ? u.followers - 1 : u.followers + 1,
            };
          });

          return { following: updatedFollowing, users: updatedUsers };
        }),

      isFollowing: (userId: string) => get().following.includes(userId),

      getFeed: () => {
        const { activities, following } = get();
        const viewerId = getCurrentUserId();
        return activities
          .filter((a) => isVisibleToViewer(a, viewerId, following))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      searchUsers: (query: string) => {
        const { users } = get();
        const q = query.toLowerCase();
        return users.filter(
          (u) => u.username.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
        );
      },

      searchActivities: (query: string) => {
        const { activities, following } = get();
        const viewerId = getCurrentUserId();
        const q = query.toLowerCase();
        return activities.filter(
          (a) =>
            (a.name || '').toLowerCase().includes(q) && isVisibleToViewer(a, viewerId, following)
        );
      },

      getUserById: (id: string) => {
        const { users } = get();
        const user = users.find((u) => u.id.toLowerCase() === id.toLowerCase());
        if (id.toLowerCase() === getCurrentUserId().toLowerCase()) {
          const profile = useProfileStore.getState();
          return {
            ...user,
            id,
            username: profile.username || user?.username || 'You',
            firstName: profile.firstName,
            lastName: profile.lastName,
            gender: profile.gender,
            birthday: profile.birthday,
            wallet: profile.wallet || id,
            avatar: profile.avatar || undefined,
            createdAt: new Date(profile.createdAt ?? 0),
            followers: user?.followers ?? 0,
            following: get().following.length,
          };
        }
        return user;
      },

      getUserActivities: (userId: string) => {
        const { activities, following } = get();
        const viewerId = getCurrentUserId();
        return activities
          .filter((a) => a.userId === userId && isVisibleToViewer(a, viewerId, following))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      reset: () => set({ users: [], activities: [], currentUserKudos: [], following: [] }),
    }),
    {
      name: 'stryde-social',
      version: 4,
      storage: createJSONStorage(() => asyncStorageAdapter, { reviver: isoDateReviver }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 4) {
          return null;
        }
        return persistedState;
      },
    }
  )
);
