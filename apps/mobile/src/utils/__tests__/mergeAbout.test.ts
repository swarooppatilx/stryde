import { describe, expect, it } from 'vitest';
import { mergeAbout } from '@/utils/mergeAbout';
import type { SocialUser } from '@/utils/socialSelectors';

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
const user = (id: string, extra: Partial<SocialUser> = {}) =>
  ({ id, username: id.slice(-2), followers: 0, following: 0, ...extra }) as SocialUser;

describe('mergeAbout', () => {
  it('puts each author’s bio and location on their user, leaving the rest alone', () => {
    const users = { [A]: user(A), [B]: user(B) };

    const merged = mergeAbout(users, { [A]: { bio: 'hi', location: 'Pune' } });

    expect(merged[A]).toMatchObject({ bio: 'hi', location: 'Pune' });
    expect(merged[B]).toBe(users[B]);
  });

  it('clears a bio the author removed', () => {
    const users = { [A]: user(A, { bio: 'old', location: 'Pune' }) };

    expect(mergeAbout(users, { [A]: { bio: '', location: '' } })[A]).toMatchObject({
      bio: undefined,
      location: undefined,
    });
  });

  it('ignores an author the app does not know yet', () => {
    const users = { [A]: user(A) };

    expect(mergeAbout(users, { [B]: { bio: 'hi', location: '' } })).toBe(users);
  });

  it('matches wallets whatever their letter case', () => {
    const upper = '0x00000000000000000000000000000000000000AA';
    const users = { [A]: user(A) };

    expect(mergeAbout(users, { [upper]: { bio: 'hi', location: '' } })[A]?.bio).toBe('hi');
  });

  it('returns the same object when nothing changed', () => {
    const users = { [A]: user(A, { bio: 'hi', location: 'Pune' }) };

    expect(mergeAbout(users, { [A]: { bio: 'hi', location: 'Pune' } })).toBe(users);
  });
});
