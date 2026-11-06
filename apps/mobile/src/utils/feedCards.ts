import type { ActivityType } from '@/types';
import type { SocialUser } from './socialSelectors';
import { suggestPeople } from './suggestedPeople';

export interface SuggestedCard {
  kind: 'suggested';
  id: string;
  people: SocialUser[];
}

export interface ClubCard {
  kind: 'club';
  id: string;
  clubId: string;
  clubName: string;
  text: string;
  /** Unix seconds. */
  at: number;
}

export interface ChallengeCard {
  kind: 'challenge';
  id: string;
  eventId: string;
  title: string;
  /** 0 to 1 of the distance goal; null when the viewer has not joined or the goal is open. */
  progress: number | null;
  joined: boolean;
}

export type FeedExtraCard = SuggestedCard | ClubCard | ChallengeCard;

/** Cards between this many feed items, so the feed stays mostly activity. */
export const CARD_GAP = 5;
const MIN_SUGGESTED = 2;
const MAX_SUGGESTED = 3;

/**
 * Places one card after every `gap` items, in order, never leading, never two in a row and never
 * trailing the list. Cards that do not fit are left out; with no items nothing is returned.
 */
export function interleaveCards<T, C>(
  items: readonly T[],
  cards: readonly C[],
  gap: number
): (T | C)[] {
  const every = Math.max(1, Math.floor(gap));
  const out: (T | C)[] = [];
  let next = 0;
  items.forEach((item, i) => {
    out.push(item);
    const isLast = i === items.length - 1;
    const card = cards[next];
    if ((i + 1) % every === 0 && !isLast && card !== undefined) {
      out.push(card);
      next++;
    }
  });
  return out;
}

interface EventLike {
  startDate: Date;
  endDate: Date;
  distanceGoal: number;
  sportType: ActivityType | 'multi';
}

interface ActivityLike {
  distance: number;
  activityType: ActivityType | string;
  createdAt: Date;
  isManual?: boolean;
  mocked?: boolean;
}

/** Share of the distance goal the viewer's own recorded activities cover inside the event window. */
export function challengeProgress(
  event: EventLike,
  activities: readonly ActivityLike[]
): number | null {
  if (!(event.distanceGoal > 0)) return null;
  const from = event.startDate.getTime();
  const to = event.endDate.getTime();
  let total = 0;
  for (const a of activities) {
    const at = new Date(a.createdAt).getTime();
    if (a.isManual || a.mocked || at < from || at > to) continue;
    if (event.sportType !== 'multi' && a.activityType !== event.sportType) continue;
    total += a.distance;
  }
  return Math.min(1, total / event.distanceGoal);
}

/** A live challenge: the viewer's joined one with progress, else an invite to the busiest. */
export function pickChallengeCard(
  events: ReadonlyArray<EventLike & { id: string; title: string; participantCount: number }>,
  joinedIds: readonly string[],
  activities: readonly ActivityLike[],
  now: Date,
  dismissed: readonly string[]
): ChallengeCard | null {
  const live = events.filter(
    (e) =>
      e.startDate.getTime() <= now.getTime() &&
      now.getTime() <= e.endDate.getTime() &&
      !dismissed.includes(`challenge:${e.id}`)
  );
  const joined = live.find((e) => joinedIds.includes(e.id));
  const pick = joined ?? [...live].sort((a, b) => b.participantCount - a.participantCount)[0];
  if (!pick) return null;
  return {
    kind: 'challenge',
    id: `challenge:${pick.id}`,
    eventId: pick.id,
    title: pick.title,
    progress: joined ? challengeProgress(pick, activities) : null,
    joined: joined !== undefined,
  };
}

/** The newest post across the viewer's joined clubs whose feeds are loaded. */
export function pickClubCard(
  clubs: ReadonlyArray<{ id: string; name: string }>,
  joinedIds: readonly string[],
  feeds: Readonly<Record<string, ReadonlyArray<{ id: string; createdAt: number; text: string }>>>,
  dismissed: readonly string[]
): ClubCard | null {
  let best: ClubCard | null = null;
  for (const club of clubs) {
    if (!joinedIds.includes(club.id)) continue;
    for (const post of feeds[club.id] ?? []) {
      const id = `club:${club.id}:${post.id}`;
      if (!post.text.trim() || dismissed.includes(id)) continue;
      if (!best || post.createdAt > best.at) {
        best = {
          kind: 'club',
          id,
          clubId: club.id,
          clubName: club.name,
          text: post.text.trim(),
          at: post.createdAt,
        };
      }
    }
  }
  return best;
}

/** A few athletes the viewer does not follow yet; null with fewer than two to show. */
export function pickSuggestedCard(
  users: Record<string, SocialUser>,
  following: ReadonlySet<string>,
  viewerId: string,
  hidden: Iterable<string>,
  dismissed: readonly string[]
): SuggestedCard | null {
  if (dismissed.includes('suggested')) return null;
  const skip = new Set([...following, ...[...hidden].map((h) => h.toLowerCase())]);
  const people = suggestPeople(users, skip, viewerId, MAX_SUGGESTED);
  return people.length >= MIN_SUGGESTED ? { kind: 'suggested', id: 'suggested', people } : null;
}
