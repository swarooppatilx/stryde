export type FollowPill = 'follow' | 'following';

/** The athlete row heads another athlete's activity; your own already says whose it is. */
export function showsAthleteRow({ isOwner }: { isOwner: boolean }): boolean {
  return !isOwner;
}

export function athleteFollowPill({
  isOwner,
  isFollowing,
}: {
  isOwner: boolean;
  isFollowing: boolean;
}): FollowPill | null {
  if (!showsAthleteRow({ isOwner })) return null;
  return isFollowing ? 'following' : 'follow';
}
