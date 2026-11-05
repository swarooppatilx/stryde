import { SPORT_TYPES } from '@/constants/activity';
import type { ActivityType } from '@/types';

export const FEED_ORDERS = ['latest', 'following_first'] as const;
export type FeedOrder = (typeof FEED_ORDERS)[number];

export const FEED_ORDER_LABEL: Record<FeedOrder, string> = {
  latest: 'Latest',
  following_first: 'Following first',
};

export type SportChoice = 'all' | ActivityType;

/** The sports in the feed, each once, in the sport picker's order; posts have no sport and add none. */
export function sportsInFeed<T>(
  items: readonly T[],
  sportOf: (item: T) => ActivityType | undefined
): ActivityType[] {
  const present = new Set<ActivityType>();
  for (const item of items) {
    const sport = sportOf(item);
    if (sport) present.add(sport);
  }
  return SPORT_TYPES.map((s) => s.type).filter((type) => present.has(type));
}

/** The chosen sport while the feed still has it, otherwise all sports. */
export function effectiveSport(
  selected: SportChoice,
  present: readonly ActivityType[]
): SportChoice {
  return selected === 'all' || present.includes(selected) ? selected : 'all';
}

/** Items of one sport; a specific sport leaves posts out, since they have none. */
export function filterBySport<T>(
  items: T[],
  sport: SportChoice,
  sportOf: (item: T) => ActivityType | undefined
): T[] {
  return sport === 'all' ? items : items.filter((item) => sportOf(item) === sport);
}

/** Newest-first items as they should read: unchanged, or athletes you follow first with time order kept in each group. */
export function orderFeed<T>(items: T[], order: FeedOrder, isFollowed: (item: T) => boolean): T[] {
  if (order === 'latest') return items;
  return [...items.filter(isFollowed), ...items.filter((item) => !isFollowed(item))];
}
