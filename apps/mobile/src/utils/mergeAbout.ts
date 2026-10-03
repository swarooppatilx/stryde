import type { SocialUser } from './socialSelectors';

/** `users` with each author's bio and location filled in; unchanged users and the whole map are reused. */
export function mergeAbout(
  users: Record<string, SocialUser>,
  about: Record<string, { bio: string; location: string }>
): Record<string, SocialUser> {
  let next: Record<string, SocialUser> | null = null;
  for (const [address, text] of Object.entries(about)) {
    const key = address.toLowerCase();
    const user = users[key];
    if (!user) continue;
    const bio = text.bio || undefined;
    const location = text.location || undefined;
    if (user.bio === bio && user.location === location) continue;
    next ??= { ...users };
    next[key] = { ...user, bio, location };
  }
  return next ?? users;
}
