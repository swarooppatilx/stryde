import type { SocialActivity, SocialUser } from '@/utils/socialSelectors';

/** Saved state holds these as JSON arrays; older migrations produced Sets. Accept both. */
function toStringSet(
  value: unknown,
  fallback: Set<string>,
  normalize: (item: string) => string = (item) => item
): Set<string> {
  if (value instanceof Set) return new Set([...value].map(normalize));
  if (Array.isArray(value)) return new Set(value.map(normalize));
  return fallback;
}

export function toUserRecord(users: SocialUser[]): Record<string, SocialUser> {
  const record: Record<string, SocialUser> = {};
  for (const user of users) {
    record[user.id.toLowerCase()] = user;
  }
  return record;
}

export function toActivityRecord(activities: SocialActivity[]): Record<string, SocialActivity> {
  const record: Record<string, SocialActivity> = {};
  for (const activity of activities) {
    record[activity.id.toLowerCase()] = activity;
  }
  return record;
}

/** Lays saved state over the fresh store, turning its arrays back into Sets. */
export function mergeSocialState<
  T extends { following: Set<string>; currentUserKudos: Set<string> },
>(persistedState: unknown, currentState: T): T {
  const state = (persistedState as Record<string, unknown>) ?? {};
  return {
    ...currentState,
    ...state,
    following: toStringSet(state.following, currentState.following, (a) => a.toLowerCase()),
    currentUserKudos: toStringSet(state.currentUserKudos, currentState.currentUserKudos),
  };
}

export function migrateSocialState(persistedState: unknown, version: number): unknown {
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
    // v6: kudos and comments sync from the chain; persisted data stays as an offline cache that chain data merges over.
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
}
