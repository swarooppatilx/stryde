import { describe, expect, it } from 'vitest';
import type { ActivityType } from '@/types';
import { effectiveSport, filterBySport, orderFeed, sportsInFeed } from '@/utils/feedView';

interface Item {
  id: string;
  sport?: ActivityType;
  followed?: boolean;
}
const sportOf = (item: Item) => item.sport;

const feed: Item[] = [
  { id: 'a', sport: 'ride', followed: false },
  { id: 'b', followed: true },
  { id: 'c', sport: 'run', followed: true },
  { id: 'd', sport: 'ride', followed: true },
  { id: 'e', sport: 'swim', followed: false },
];

describe('sportsInFeed', () => {
  it('lists each sport once, in the order the sport picker uses, ignoring posts', () => {
    expect(sportsInFeed(feed, sportOf)).toEqual(['run', 'ride', 'swim']);
  });

  it('is empty for an empty feed', () => {
    expect(sportsInFeed([], sportOf)).toEqual([]);
  });
});

describe('effectiveSport', () => {
  it('keeps a sport that is still in the feed', () => {
    expect(effectiveSport('ride', ['run', 'ride'])).toBe('ride');
  });

  it('falls back to all when the chosen sport left the feed', () => {
    expect(effectiveSport('swim', ['run', 'ride'])).toBe('all');
    expect(effectiveSport('all', ['run'])).toBe('all');
  });
});

describe('filterBySport', () => {
  it('returns everything, posts included, for all sports', () => {
    expect(filterBySport(feed, 'all', sportOf)).toBe(feed);
  });

  it('keeps only that sport, which leaves posts out', () => {
    expect(filterBySport(feed, 'ride', sportOf).map((i) => i.id)).toEqual(['a', 'd']);
  });
});

describe('orderFeed', () => {
  const followed = (item: Item) => item.followed === true;

  it('leaves the newest-first order alone for latest', () => {
    expect(orderFeed(feed, 'latest', followed)).toBe(feed);
  });

  it('puts followed athletes first, newest first within each group', () => {
    expect(orderFeed(feed, 'following_first', followed).map((i) => i.id)).toEqual([
      'b',
      'c',
      'd',
      'a',
      'e',
    ]);
  });

  it('does not change the list it is given', () => {
    const copy = [...feed];
    orderFeed(feed, 'following_first', followed);
    expect(feed).toEqual(copy);
  });
});
