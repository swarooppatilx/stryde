import type { ChallengeFilter } from '@/utils/challengeFilter';

export interface GroupsEmptyInput {
  tab: 'Challenges' | 'Clubs' | 'Events';
  /** `total` is everything loaded, before any search or filter narrowed it. */
  clubs: { total: number; loading: boolean; error: boolean };
  events: { total: number; loading: boolean; error: boolean; registryDeployed: boolean };
  /** `loaded` is false until the first read of the athlete's challenges finishes. */
  challenges: { loaded: boolean; total: number; error: boolean };
  challengeFilter: ChallengeFilter;
  /** A profile with no chain cannot read challenges at all. */
  noChain: boolean;
  walletFailed: boolean;
  hasAddress: boolean;
}

export type GroupsEmptyView =
  | { kind: 'loading' }
  | { kind: 'error'; what: 'clubs' | 'events' | 'challenges' }
  | { kind: 'no-clubs' }
  | { kind: 'no-clubs-found' }
  | { kind: 'no-events' }
  | { kind: 'events-not-live' }
  | { kind: 'sandbox' }
  | { kind: 'wallet' }
  | { kind: 'filtered-challenges' }
  | { kind: 'no-challenges' };

/**
 * What a Groups list with nothing to show should say. A failed or running read only counts while
 * there is nothing already on screen: a refresh that fails must not hide what was loaded.
 */
export function groupsEmptyView(input: GroupsEmptyInput): GroupsEmptyView {
  const { clubs, events, challenges } = input;

  if (input.tab === 'Clubs') {
    if (clubs.loading && clubs.total === 0) return { kind: 'loading' };
    if (clubs.error && clubs.total === 0) return { kind: 'error', what: 'clubs' };
    return { kind: clubs.total === 0 ? 'no-clubs' : 'no-clubs-found' };
  }

  if (input.tab === 'Events') {
    if (events.loading && events.total === 0) return { kind: 'loading' };
    if (events.error && events.total === 0) return { kind: 'error', what: 'events' };
    return { kind: events.registryDeployed ? 'no-events' : 'events-not-live' };
  }

  if (input.noChain) return { kind: 'sandbox' };
  if (!challenges.loaded) {
    // No wallet means no address to read challenges for: say so, instead of spinning for ever.
    return input.walletFailed && !input.hasAddress ? { kind: 'wallet' } : { kind: 'loading' };
  }
  if (challenges.error && challenges.total === 0) return { kind: 'error', what: 'challenges' };
  if (input.challengeFilter !== 'all' && challenges.total > 0) {
    return { kind: 'filtered-challenges' };
  }
  return { kind: 'no-challenges' };
}
