import type { SocialUser } from '@/utils/socialSelectors';

/** Athletes the viewer does not follow yet, most followed first, for the empty search screen. */
export function suggestPeople(
  users: Record<string, SocialUser>,
  following: ReadonlySet<string>,
  viewerId: string,
  limit: number
): SocialUser[] {
  const viewer = viewerId.toLowerCase();
  return Object.values(users)
    .filter((u) => u.id.toLowerCase() !== viewer && !following.has(u.id.toLowerCase()))
    .sort((a, b) => b.followers - a.followers || a.username.localeCompare(b.username))
    .slice(0, limit);
}
