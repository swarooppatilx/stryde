import * as Linking from 'expo-linking';

/**
 * The links people share. They are resource paths like the reference app's, `stryde://activities/42`,
 * so the same path can later be served as a web link; see `utils/linkPaths.ts` for the paths and for how
 * older, screen-named links are still understood.
 */

export function buildActivityDeepLink(activityId: string): string {
  return Linking.createURL(`activities/${encodeURIComponent(activityId)}`);
}

export function buildProfileDeepLink(athleteId: string): string {
  return Linking.createURL(`athletes/${encodeURIComponent(athleteId)}`);
}

/** A link to a club, event or challenge page. */
export function buildDetailDeepLink(
  resource: 'clubs' | 'events' | 'challenges',
  id: string
): string {
  return Linking.createURL(`${resource}/${encodeURIComponent(id)}`);
}
