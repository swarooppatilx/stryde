import { getSportLabel } from '@/constants/activity';
import type { useProfileStore } from '@/stores/profileStore';
import type { Activity, User } from '@/types';
import { sameAddress } from '@/utils/address';

export interface SocialUser extends User {
  bio?: string;
  location?: string;
  followers: number;
  following: number;
}

export interface SocialActivity extends Activity {
  name?: string;
  /** On-chain id as a decimal string — persisted to JSON, which can't hold a bigint. */
  activityId?: string;
  kudos: string[];
  /** When each kudos was given (unix seconds, keyed by lower-case giver); absent for kudos not yet read back from the chain. */
  kudosAt?: Record<string, number>;
  comments: SocialComment[];
}

export function isVisibleToViewer(
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

/** Athletes whose username or wallet contains `query`. */
export function searchUsers(users: Record<string, SocialUser>, query: string): SocialUser[] {
  const q = query.toLowerCase();
  return Object.values(users).filter(
    (u) => u.username.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
  );
}

/** Posts the viewer may see whose name (or sport, when unnamed) contains `query`. */
export function searchActivities(
  activities: Record<string, SocialActivity>,
  query: string,
  viewerId: string,
  following: ReadonlySet<string>
): SocialActivity[] {
  const q = query.toLowerCase();
  return Object.values(activities).filter(
    (a) =>
      (a.name || getSportLabel(a.activityType)).toLowerCase().includes(q) &&
      isVisibleToViewer(a, viewerId, following)
  );
}

/** The posts `viewerId` may see, newest first. A pure selector: pass the store's own state. */
export function visibleActivities(
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

type ProfileFields = Pick<
  ReturnType<typeof useProfileStore.getState>,
  | 'username'
  | 'firstName'
  | 'lastName'
  | 'gender'
  | 'birthday'
  | 'wallet'
  | 'avatar'
  | 'createdAt'
  | 'bio'
  | 'location'
>;

/** An athlete by wallet; for the viewer, filled in from their own profile and follow counts. */
export function resolveUser(
  id: string,
  ctx: {
    users: Record<string, SocialUser>;
    me: string;
    profile: ProfileFields;
    myFollowerCount: number;
    followingCount: number;
  }
): SocialUser | undefined {
  const user = ctx.users[id.toLowerCase()];
  if (!sameAddress(id, ctx.me)) return user;
  const { profile } = ctx;
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
    bio: profile.bio || undefined,
    location: profile.location || undefined,
    createdAt: new Date(profile.createdAt ?? 0),
    followers: ctx.myFollowerCount,
    following: ctx.followingCount,
  };
}
