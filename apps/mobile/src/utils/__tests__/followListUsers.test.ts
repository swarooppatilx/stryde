import { describe, expect, it } from 'vitest';
import { followListUsers } from '@/utils/followListUsers';
import type { SocialUser } from '@/utils/socialSelectors';

const user = (id: string) => ({ id, username: id }) as SocialUser;
const known: Record<string, SocialUser> = { a: user('a'), b: user('b') };
const resolve = (id: string) => known[id.toLowerCase()];

describe('followListUsers', () => {
  it('keeps the order the list came in', () => {
    expect(followListUsers(['b', 'a'], resolve).map((u) => u.id)).toEqual(['b', 'a']);
  });

  it('skips wallets that have no registered profile to show', () => {
    expect(followListUsers(['a', 'stranger'], resolve).map((u) => u.id)).toEqual(['a']);
  });

  it('lists each athlete once', () => {
    expect(followListUsers(['a', 'A', 'a'], resolve)).toHaveLength(1);
  });
});
