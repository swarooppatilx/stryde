/** The follow button's word: "Follow back" when they already follow you. */
export function followButtonLabel({
  isFollowing,
  followsViewer,
}: {
  isFollowing: boolean;
  followsViewer: boolean;
}): 'Follow' | 'Follow back' | 'Following' {
  if (isFollowing) return 'Following';
  return followsViewer ? 'Follow back' : 'Follow';
}

/** Whether an athlete is among the viewer's followers (addresses compared without letter case). */
export function followsViewer(
  athlete: string,
  followerEntries: readonly { address: string }[]
): boolean {
  const key = athlete.toLowerCase();
  return followerEntries.some((entry) => entry.address.toLowerCase() === key);
}
