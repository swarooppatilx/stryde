import * as Linking from 'expo-linking';

/**
 * The links people share. They are resource paths, `stryde://activities/42`,
 * so the same path can later be served as a web link; see `utils/linkPaths.ts` for the paths and for how
 * older, screen-named links are still understood.
 */

const SHARE_SCHEME = 'stryde';

function shareUrl(path: string): string {
  return Linking.createURL(path, { scheme: SHARE_SCHEME });
}

export function buildActivityDeepLink(activityId: string): string {
  return shareUrl(`activities/${encodeURIComponent(activityId)}`);
}

export function buildProfileDeepLink(athleteId: string): string {
  return shareUrl(`athletes/${encodeURIComponent(athleteId)}`);
}

/** A link to a club, event or challenge page. */
export function buildDetailDeepLink(
  resource: 'clubs' | 'events' | 'challenges',
  id: string
): string {
  return shareUrl(`${resource}/${encodeURIComponent(id)}`);
}
