import { describe, expect, it } from 'vitest';
import type { SocialUser } from '@/utils/socialSelectors';
import { suggestPeople } from '@/utils/suggestedPeople';

const user = (id: string, followers: number): SocialUser =>
  ({ id, username: id, followers }) as SocialUser;

describe('suggestPeople', () => {
  const users = { a: user('a', 3), b: user('b', 9), c: user('c', 5), me: user('me', 99) };

  it('offers the most followed athletes first', () => {
    expect(suggestPeople(users, new Set(), 'me', 5).map((u) => u.id)).toEqual(['b', 'c', 'a']);
  });

  it('leaves out the viewer and anyone they already follow', () => {
    expect(suggestPeople(users, new Set(['b']), 'me', 5).map((u) => u.id)).toEqual(['c', 'a']);
  });

  it('breaks ties by username so the list does not reshuffle', () => {
    const tied = { z: user('z', 1), y: user('y', 1) };

    expect(suggestPeople(tied, new Set(), 'me', 5).map((u) => u.id)).toEqual(['y', 'z']);
  });

  it('caps the list', () => {
    expect(suggestPeople(users, new Set(), 'me', 2)).toHaveLength(2);
  });

  it('recognises the viewer and followed athletes whatever the address casing', () => {
    const mixed = { '0xAbC': user('0xAbC', 5), '0xDeF': user('0xDeF', 4) };

    expect(suggestPeople(mixed, new Set(['0xdef']), '0xABC', 5)).toEqual([]);
  });
});
