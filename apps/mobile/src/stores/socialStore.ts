import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getCurrentUserId } from '@/constants/config';
import {
  MOCK_ACTIVITIES,
  MOCK_USERS,
  type MockActivity,
  type MockComment,
  type MockUser,
} from '@/data/mock-social';
import { asyncStorageAdapter } from '@/utils/storage';

interface SocialState {
  users: MockUser[];
  activities: MockActivity[];
  currentUserKudos: string[];
  following: string[];

  toggleKudos: (activityId: string) => void;
  addComment: (activityId: string, text: string) => void;
  toggleCommentLike: (activityId: string, commentId: string) => void;
  toggleFollow: (userId: string) => void;
  isFollowing: (userId: string) => boolean;
  getFeed: () => MockActivity[];
  searchUsers: (query: string) => MockUser[];
  searchActivities: (query: string) => MockActivity[];
  getUserById: (id: string) => MockUser | undefined;
  getUserActivities: (userId: string) => MockActivity[];
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      users: MOCK_USERS,
      activities: MOCK_ACTIVITIES,
      currentUserKudos: [],
      following: [],

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
          const comment: MockComment = {
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

      toggleFollow: (userId: string) =>
        set((state) => {
          const isFollowing = state.following.includes(userId);
          const updatedFollowing = isFollowing
            ? state.following.filter((id) => id !== userId)
            : [...state.following, userId];
          return { following: updatedFollowing };
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
          (u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
        );
      },

      searchActivities: (query: string) => {
        const { activities } = get();
        const q = query.toLowerCase();
        return activities.filter((a) => a.name.toLowerCase().includes(q));
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
      storage: createJSONStorage(() => asyncStorageAdapter),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 4) {
          return null;
        }
        return persistedState;
      },
    }
  )
);
