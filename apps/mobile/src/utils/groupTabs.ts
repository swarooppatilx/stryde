/** The Groups tab order: Challenges, Clubs, Events. */
export const GROUP_TABS = ['Challenges', 'Clubs', 'Events'] as const;
export type GroupTab = (typeof GROUP_TABS)[number];

/**
 * Groups opens on Clubs for someone who has never uploaded (nothing to compete on yet, so
 * finding a club is the useful first step) and on Challenges for everyone else.
 */
export function defaultGroupTab({ hasActivities }: { hasActivities: boolean }): GroupTab {
  return hasActivities ? 'Challenges' : 'Clubs';
}
