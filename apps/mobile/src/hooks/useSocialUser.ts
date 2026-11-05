import { useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useProfileStore } from '@/stores/profileStore';
import { resolveUser, type SocialUser, useSocialStore } from '@/stores/socialStore';
import { useCurrentUserId } from './useCurrentUserId';

/** `(id) => athlete`, renewed when users load or the viewer's profile or follows change so dependent memos recompute. */
export function useUserResolver(): (id: string) => SocialUser | undefined {
  const me = useCurrentUserId();
  const { users, myFollowerCount, followingCount } = useSocialStore(
    useShallow((s) => ({
      users: s.users,
      myFollowerCount: s.myFollowerCount,
      followingCount: s.following.size,
    }))
  );
  const profile = useProfileStore(
    useShallow((s) => ({
      username: s.username,
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender,
      birthday: s.birthday,
      wallet: s.wallet,
      avatar: s.avatar,
      createdAt: s.createdAt,
      bio: s.bio,
      location: s.location,
    }))
  );
  return useCallback(
    (id: string) => resolveUser(id, { users, me, profile, myFollowerCount, followingCount }),
    [users, me, profile, myFollowerCount, followingCount]
  );
}

/** One athlete by wallet; updates as `useUserResolver` does. */
export function useSocialUser(id: string | undefined): SocialUser | undefined {
  const resolve = useUserResolver();
  return id ? resolve(id) : undefined;
}
