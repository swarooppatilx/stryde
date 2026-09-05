import { services } from '@repo/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getCurrentUserId } from '@/constants/config';
import { useActivityStore } from '@/stores/activityStore';
import type { Activity, User } from '@/types';
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
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      users: [],
      activities: [],
      currentUserKudos: [],
      following: [],

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
            avatar: undefined,
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
            const existingByHash = new Map(state.activities.map((a) => [a.id, a]));

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

            return { activities: socialActivities };
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
        const { activities } = get();
        return [...activities].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },

      searchUsers: (query: string) => {
        const { users } = get();
        const q = query.toLowerCase();
        return users.filter(
          (u) => u.username.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
        );
      },

      searchActivities: (query: string) => {
        const { activities } = get();
        const q = query.toLowerCase();
        return activities.filter((a) => (a.name || '').toLowerCase().includes(q));
      },

      getUserById: (id: string) => {
        const { users } = get();
        return users.find((u) => u.id === id);
      },

      getUserActivities: (userId: string) => {
        const { activities } = get();
        return [...activities]
          .filter((a) => a.userId === userId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
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
