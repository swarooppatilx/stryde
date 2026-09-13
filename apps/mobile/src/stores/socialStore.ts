import { type SyncedComment, services } from '@repo/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getSportLabel } from '@/constants/activity';
import { getCurrentUserId } from '@/constants/config';
import { ipfsToHttpUrl } from '@/services/ipfsService';
import { getActiveWallet, queuedWrite } from '@/services/wallet';
import { useActivityStore } from '@/stores/activityStore';
import { useProfileStore } from '@/stores/profileStore';
import type { Activity, User } from '@/types';
import { mergeLocalActivities } from '@/utils/socialFeed';
import { chainScopedStorageAdapter, isoDateReviver } from '@/utils/storage';
import { Toast } from '@/utils/toast';

function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

function toUserRecord(users: SocialUser[]): Record<string, SocialUser> {
  const record: Record<string, SocialUser> = {};
  for (const user of users) {
    record[user.id.toLowerCase()] = user;
  }
  return record;
}

function toActivityRecord(activities: SocialActivity[]): Record<string, SocialActivity> {
  const record: Record<string, SocialActivity> = {};
  for (const activity of activities) {
    record[activity.id.toLowerCase()] = activity;
  }
  return record;
}

function resolveOnchainActivityId(activity: SocialActivity): bigint | undefined {
  if (activity.activityId != null) return BigInt(activity.activityId);
  // A just-recorded activity isn't in the chain-synced feed yet; its id was
  // stored on the local record when recordActivity confirmed.
  const local = useActivityStore
    .getState()
    .activities.find((a) => a.id === activity.id || a.activityHash === activity.activityHash);
  return local?.onchainActivityId ? BigInt(local.onchainActivityId) : undefined;
}

export interface SocialUser extends User {
  bio?: string;
  location?: string;
  followers: number;
  following: number;
}

export interface SocialActivity extends Activity {
  name?: string;
  activityId?: bigint;
  kudos: string[];
  comments: SocialComment[];
}

function isVisibleToViewer(
  activity: SocialActivity,
  viewerId: string,
  following: ReadonlySet<string>
): boolean {
  if (sameAddress(activity.userId, viewerId)) return true;
  switch (activity.privacy) {
    case 'only_me':
      return false;
    case 'followers':
      return following.has(activity.userId.toLowerCase());
    default:
      return true;
  }
}

function visibleActivities(
  activities: SocialActivity[],
  viewerId: string,
  following: ReadonlySet<string>
): SocialActivity[] {
  return activities
    .filter((a) => isVisibleToViewer(a, viewerId, following))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export interface SocialComment {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
  likedBy: string[];
}

interface SocialState {
  users: Record<string, SocialUser>;
  activities: Record<string, SocialActivity>;
  currentUserKudos: Set<string>;
  following: Set<string>;

  fetchUsers: () => Promise<void>;
  fetchActivities: () => Promise<void>;
  syncLocalActivities: () => void;
  toggleKudos: (activityId: string) => Promise<void>;
  addComment: (activityId: string, text: string) => Promise<void>;
  toggleCommentLike: (activityId: string, commentId: string) => void;
  updateActivity: (activityId: string, updates: Partial<SocialActivity>) => void;
  toggleFollow: (userId: string) => void;
  isFollowing: (userId: string) => boolean;
  getFeed: () => SocialActivity[];
  searchUsers: (query: string) => SocialUser[];
  searchActivities: (query: string) => SocialActivity[];
  getUserById: (id: string) => SocialUser | undefined;
  getUserActivities: (userId: string) => SocialActivity[];
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
          set({ users: toUserRecord(socialUsers) });
        } catch (e) {
          console.warn('[Social] Failed to fetch users:', e);
        }
      },

      fetchActivities: async () => {
        try {
          const chainActivities = await services.sync.syncAllActivitiesFromChain();
          const localByHash = new Map(
            useActivityStore
              .getState()
              .activities.filter((a) => a.activityHash)
              .map((a) => [a.activityHash, a])
          );

          // Fetch social data (kudos + comments) from chain/subgraph
          let socialData: {
            kudos: { activityId: bigint; giver: string }[];
            comments: SyncedComment[];
          } = {
            kudos: [],
            comments: [],
          };
          try {
            socialData = await services.social.syncSocialFromChain();
          } catch (e) {
            console.warn('[Social] Failed to sync social data:', e);
          }

          // Build kudos map: activityId -> giver[]
          const kudosByActivityId = new Map<string, Set<string>>();
          for (const k of socialData.kudos) {
            const key = k.activityId.toString();
            if (!kudosByActivityId.has(key)) kudosByActivityId.set(key, new Set());
            kudosByActivityId.get(key)!.add(k.giver.toLowerCase());
          }

          // Build comments map: activityId -> SocialComment[]
          const commentsByActivityId = new Map<string, SocialComment[]>();
          for (const c of socialData.comments) {
            const key = c.activityId.toString();
            if (!commentsByActivityId.has(key)) commentsByActivityId.set(key, []);
            commentsByActivityId.get(key)!.push({
              id: c.id,
              userId: c.author,
              text: c.text ?? '',
              createdAt: new Date(c.createdAt * 1000),
              likedBy: [],
            });
          }

          // Track current user's kudos for the Set
          const currentUserId = getCurrentUserId().toLowerCase();
          const userKudos = new Set<string>();

          set((state) => {
            const existingByHash = new Map(
              Object.values(state.activities).map((a) => [a.activityHash || a.id, a])
            );

            const socialActivities: SocialActivity[] = chainActivities.map((a) => {
              const local = localByHash.get(a.activityHash);
              const existing = existingByHash.get(a.activityHash);

              // Map chain activityId (bigint) to kudos/comments
              const activityIdStr = a.activityId.toString();
              const chainKudos = kudosByActivityId.get(activityIdStr);
              const chainComments = commentsByActivityId.get(activityIdStr);

              const kudos: string[] = chainKudos ? Array.from(chainKudos) : [];
              if (
                !chainKudos &&
                existing?.kudos.includes(currentUserId) &&
                existing.kudos.length <= 1
              ) {
                kudos.push(currentUserId);
              }

              const comments: SocialComment[] = [];
              const seenCommentIds = new Set<string>();
              const pushUnique = (list: SocialComment[]) => {
                for (const c of list) {
                  if (!seenCommentIds.has(c.id)) {
                    seenCommentIds.add(c.id);
                    comments.push(c);
                  }
                }
              };
              if (chainComments) pushUnique(chainComments);
              if (existing?.comments) pushUnique(existing.comments);

              if (chainKudos?.has(currentUserId)) {
                userKudos.add(a.activityHash);
              }

              return {
                id: a.activityHash,
                userId: a.owner,
                name: local?.name ?? a.metadataName,
                activityType: local?.activityType ?? a.activityType,
                distance: local?.distance ?? a.distance,
                duration: local?.duration ?? a.duration,
                polyline: local?.polyline || a.metadataPolyline || '',
                territory: local?.territory || a.metadataTerritory || null,
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
                activityId: a.activityId,
                kudos,
                comments,
              };
            });

            const localKeys = new Set(
              useActivityStore.getState().activities.map((a) => a.activityHash || a.id)
            );
            const localSocial = Object.values(state.activities).filter((a) =>
              localKeys.has(a.activityHash || a.id)
            );
            return {
              currentUserKudos: userKudos,
              activities: mergeLocalActivities(
                toActivityRecord([...localSocial, ...socialActivities]),
                useActivityStore.getState().activities
              ),
            };
          });
        } catch (e) {
          console.warn('[Social] Failed to fetch activities:', e);
        }
      },

      toggleKudos: async (activityId: string) => {
        const state = get();
        const currentUserId = getCurrentUserId();
        const activity = state.activities[activityId];
        const hasKudos = activity
          ? activity.kudos.some((id) => id.toLowerCase() === currentUserId.toLowerCase())
          : state.currentUserKudos.has(activityId);

        // Optimistic update
        const updatedKudos = new Set(state.currentUserKudos);
        if (hasKudos) {
          updatedKudos.delete(activityId);
        } else {
          updatedKudos.add(activityId);
        }

        const updatedActivity = activity
          ? {
              ...activity,
              kudos: hasKudos
                ? activity.kudos.filter((id) => id.toLowerCase() !== currentUserId.toLowerCase())
                : [...activity.kudos, currentUserId.toLowerCase()],
            }
          : undefined;

        set({
          currentUserKudos: updatedKudos,
          ...(updatedActivity
            ? { activities: { ...state.activities, [activityId]: updatedActivity } }
            : {}),
        });

        // Send on-chain tx
        const onchainId = activity ? resolveOnchainActivityId(activity) : undefined;

        try {
          if (!getActiveWallet() || onchainId === undefined) {
            throw new Error('Activity is not on-chain yet');
          }
          await queuedWrite(async (w) => {
            await services.social.toggleKudos(w, onchainId);
          });
        } catch (e) {
          console.warn('[Social] Kudos tx failed, rolling back:', e);
          Toast.fail("Couldn't save kudos", 2);
          // Rollback
          const rollbackKudos = new Set(get().currentUserKudos);
          if (hasKudos) {
            rollbackKudos.add(activityId);
          } else {
            rollbackKudos.delete(activityId);
          }
          const rollbackActivity = get().activities[activityId];
          if (rollbackActivity) {
            set({
              currentUserKudos: rollbackKudos,
              activities: {
                ...get().activities,
                [activityId]: {
                  ...rollbackActivity,
                  kudos: hasKudos
                    ? [...rollbackActivity.kudos, currentUserId]
                    : rollbackActivity.kudos.filter((id) => id !== currentUserId),
                },
              },
            });
          }
        }
      },

      addComment: async (activityId: string, text: string) => {
        const state = get();
        const currentUserId = getCurrentUserId();
        const activity = state.activities[activityId];
        if (!activity) return;

        // Build a stable comment ID
        const commentIdBytes = services.social.computeCommentId(
          resolveOnchainActivityId(activity) ?? 0n,
          currentUserId as `0x${string}`,
          text,
          BigInt(Math.floor(Date.now() / 1000))
        );

        const comment: SocialComment = {
          id: commentIdBytes,
          userId: currentUserId,
          text,
          createdAt: new Date(),
          likedBy: [],
        };

        // Optimistic update
        set({
          activities: {
            ...state.activities,
            [activityId]: { ...activity, comments: [...activity.comments, comment] },
          },
        });

        // Upload to IPFS + on-chain
        const onchainId = resolveOnchainActivityId(activity);

        try {
          if (!getActiveWallet() || onchainId === undefined) {
            throw new Error('Activity is not on-chain yet');
          }
          const { cid } = await services.social.uploadCommentToIpfs({
            activityHash: activity.activityHash ?? '',
            commentId: commentIdBytes,
            author: currentUserId,
            text,
            createdAt: new Date().toISOString(),
          });

          await queuedWrite(async (w) => {
            await services.social.addComment(w, onchainId, commentIdBytes as `0x${string}`, cid);
          });
        } catch (e) {
          console.warn('[Social] Comment tx failed, rolling back:', e);
          Toast.fail("Couldn't post comment", 2);
          // Rollback: remove the optimistic comment
          const rollbackActivity = get().activities[activityId];
          if (rollbackActivity) {
            set({
              activities: {
                ...get().activities,
                [activityId]: {
                  ...rollbackActivity,
                  comments: rollbackActivity.comments.filter((c) => c.id !== commentIdBytes),
                },
              },
            });
          }
        }
      },

      toggleCommentLike: (activityId: string, commentId: string) =>
        set((state) => {
          const activity = state.activities[activityId];
          if (!activity) return state;
          const currentUserId = getCurrentUserId();
          const updatedActivity = {
            ...activity,
            comments: activity.comments.map((c) => {
              if (c.id !== commentId) return c;
              const hasLiked = (c.likedBy ?? []).includes(currentUserId);
              return {
                ...c,
                likedBy: hasLiked
                  ? (c.likedBy ?? []).filter((id) => id !== currentUserId)
                  : [...(c.likedBy ?? []), currentUserId],
              };
            }),
          };
          return { activities: { ...state.activities, [activityId]: updatedActivity } };
        }),

      updateActivity: (activityId: string, updates: Partial<SocialActivity>) =>
        set((state) => {
          const activity = state.activities[activityId];
          if (!activity) return state;
          return {
            activities: { ...state.activities, [activityId]: { ...activity, ...updates } },
          };
        }),

      toggleFollow: (userId: string) =>
        set((state) => {
          const key = userId.toLowerCase();
          const isCurrentlyFollowing = state.following.has(key);
          const updatedFollowing = new Set(state.following);
          if (isCurrentlyFollowing) {
            updatedFollowing.delete(key);
          } else {
            updatedFollowing.add(key);
          }

          const existingUser = state.users[key];
          if (!existingUser) return { following: updatedFollowing };

          return {
            following: updatedFollowing,
            users: {
              ...state.users,
              [key]: {
                ...existingUser,
                followers: isCurrentlyFollowing
                  ? existingUser.followers - 1
                  : existingUser.followers + 1,
              },
            },
          };
        }),

      isFollowing: (userId: string) => get().following.has(userId.toLowerCase()),

      getFeed: () => {
        const viewerId = getCurrentUserId();
        const { activities, following } = get();
        return visibleActivities(Object.values(activities), viewerId, following);
      },

      searchUsers: (query: string) => {
        const { users } = get();
        const q = query.toLowerCase();
        return Object.values(users).filter(
          (u) => u.username.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
        );
      },

      searchActivities: (query: string) => {
        const { activities, following } = get();
        const viewerId = getCurrentUserId();
        const q = query.toLowerCase();
        return Object.values(activities).filter(
          (a) =>
            (a.name || getSportLabel(a.activityType)).toLowerCase().includes(q) &&
            isVisibleToViewer(a, viewerId, following)
        );
      },

      getUserById: (id: string) => {
        const { users } = get();
        const user = users[id.toLowerCase()];
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
            following: get().following.size,
          };
        }
        return user;
      },

      getUserActivities: (userId: string) => {
        const { activities, following } = get();
        const viewerId = getCurrentUserId();
        return visibleActivities(
          Object.values(activities).filter((a) => sameAddress(a.userId, userId)),
          viewerId,
          following
        );
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
      }),
      merge: (persistedState: unknown, currentState: SocialState) => {
        const state = (persistedState as Record<string, unknown>) ?? {};
        return {
          ...currentState,
          ...state,
          following: Array.isArray(state.following)
            ? new Set(state.following.map((a: string) => a.toLowerCase()))
            : currentState.following,
          currentUserKudos: Array.isArray(state.currentUserKudos)
            ? new Set(state.currentUserKudos)
            : currentState.currentUserKudos,
        };
      },
      migrate: (persistedState: unknown, version: number) => {
        if (version < 4) {
          const state = persistedState as Record<string, unknown>;
          return {
            users: {} as Record<string, SocialUser>,
            activities: {} as Record<string, SocialActivity>,
            following: [] as string[],
            currentUserKudos: [] as string[],
            blockedUsers: (state.blockedUsers as `0x${string}`[]) ?? [],
          };
        }
        if (version < 5) {
          const state = persistedState as Record<string, unknown>;
          return {
            ...state,
            users: Array.isArray(state.users)
              ? toUserRecord(state.users as SocialUser[])
              : ((state.users as Record<string, SocialUser>) ?? {}),
            activities: Array.isArray(state.activities)
              ? toActivityRecord(state.activities as SocialActivity[])
              : ((state.activities as Record<string, SocialActivity>) ?? {}),
            following: Array.isArray(state.following)
              ? new Set(state.following.map((a: string) => a.toLowerCase()))
              : (state.following ?? []),
            currentUserKudos: Array.isArray(state.currentUserKudos)
              ? new Set(state.currentUserKudos)
              : (state.currentUserKudos ?? []),
          };
        }
        if (version < 6) {
          // v6: kudos/comments now synced from chain. Keep persisted data as offline cache;
          // fresh from chain will merge on top during fetchActivities.
          const state = persistedState as Record<string, unknown>;
          return {
            ...state,
            following: Array.isArray(state.following)
              ? new Set(state.following.map((a: string) => a.toLowerCase()))
              : (state.following ?? []),
            currentUserKudos: Array.isArray(state.currentUserKudos)
              ? new Set(state.currentUserKudos)
              : (state.currentUserKudos ?? []),
          };
        }
        return persistedState;
      },
    }
  )
);
