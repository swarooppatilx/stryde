import { services } from '@repo/shared';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getSportLabel } from '@/constants/activity';
import { getCurrentUserId } from '@/constants/config';
import { ipfsToHttpUrl } from '@/services/ipfsService';
import { useActivityStore } from '@/stores/activityStore';
import { useProfileStore } from '@/stores/profileStore';
import type { Activity, User } from '@/types';
import { mergeLocalActivities } from '@/utils/socialFeed';
import { asyncStorageAdapter, isoDateReviver } from '@/utils/storage';

/**
 * getCurrentUserId() is checksummed (from Privy/viem) while activity.userId /
 * user.id often come from the subgraph, which returns lowercase addresses —
 * so exact string equality between the two fails even when they refer to the
 * same wallet.
 */
function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

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
  if (sameAddress(activity.userId, viewerId)) return true;
  switch (activity.privacy) {
    case 'only_me':
      return false;
    case 'followers':
      return following.some((f) => sameAddress(f, activity.userId));
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
        } catch (e) {
          console.warn('[Social] Failed to fetch users:', e);
        }
      },

      // The cross-user feed is sourced from the chain (subgraph when available,
      // else ActivityRecorded/ActivityMetadataUpdated logs directly). Chain-only
      // fields (distance/duration/territoryArea) come from the log/entity itself.
      // Richer fields (name/description/photos) prefer this device's own
      // activityStore record when present (e.g. the poster's own device, right
      // after posting), and otherwise fall back to the IPFS metadata resolved
      // from the activity's on-chain metadataCid — this is what lets those
      // fields show up on *other* devices/users instead of being blank.
      // `polyline` has no on-chain or IPFS equivalent, so it stays local-only.
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
                name: local?.name ?? a.metadataName,
                activityType: local?.activityType ?? a.activityType,
                distance: local?.distance ?? a.distance,
                duration: local?.duration ?? a.duration,
                polyline: local?.polyline ?? '',
                territory: local?.territory ?? null,
                territoryArea: local?.territoryArea ?? a.territoryArea,
                description: local?.description ?? a.metadataDescription,
                feel: local?.feel,
                privacy: local?.privacy,
                image: local?.image ?? a.metadataPhotos?.[0],
                images: local?.images ?? a.metadataPhotos,
                isManual: local?.isManual,
                activityHash: a.activityHash,
                txHash: local?.txHash,
                metadataCid: local?.metadataCid ?? a.metadataCid,
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
        } catch (e) {
          console.warn('[Social] Failed to fetch activities:', e);
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
            id: `comment-${Date.now()}-${Crypto.randomUUID().slice(0, 8)}`,
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
          const isFollowing = state.following.some((id) => sameAddress(id, userId));
          const updatedFollowing = isFollowing
            ? state.following.filter((id) => !sameAddress(id, userId))
            : [...state.following, userId];

          const updatedUsers = state.users.map((u) => {
            if (!sameAddress(u.id, userId)) return u;
            return {
              ...u,
              followers: isFollowing ? u.followers - 1 : u.followers + 1,
            };
          });

          return { following: updatedFollowing, users: updatedUsers };
        }),

      isFollowing: (userId: string) => get().following.some((id) => sameAddress(id, userId)),

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
        // Chain-sourced activities from other users only have a `name` when the
        // poster attached IPFS metadata via setActivityMetadata (see fetchActivities
        // above); otherwise fall back to a sport-type label so they're still
        // searchable.
        return activities.filter(
          (a) =>
            (a.name || getSportLabel(a.activityType)).toLowerCase().includes(q) &&
            isVisibleToViewer(a, viewerId, following)
        );
      },

      getUserById: (id: string) => {
        const { users } = get();
        const user = users.find((u) => sameAddress(u.id, id));
        if (sameAddress(id, getCurrentUserId())) {
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
          .filter((a) => sameAddress(a.userId, userId) && isVisibleToViewer(a, viewerId, following))
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
          const state = persistedState as Record<string, unknown>;
          return {
            ...state,
            activities: (state.activities as unknown[]) ?? [],
            users: (state.users as Record<string, unknown>[]) ?? [],
            following: (state.following as `0x${string}`[]) ?? [],
            blockedUsers: (state.blockedUsers as `0x${string}`[]) ?? [],
          };
        }
        return persistedState;
      },
    }
  )
);
