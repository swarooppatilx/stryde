import { describe, expect, it } from 'vitest';
import {
  resolveUser,
  type SocialActivity,
  type SocialUser,
  searchActivities,
  searchUsers,
  visibleActivities,
} from '@/utils/socialSelectors';

const ME = '0x00000000000000000000000000000000000000aa';
const ASHA = '0x00000000000000000000000000000000000000bb';

const user = (id: string, username: string): SocialUser =>
  ({ id, username, followers: 0, following: 0 }) as SocialUser;

const post = (id: string, over: Partial<SocialActivity>): SocialActivity =>
  ({
    id,
    userId: ASHA,
    activityType: 'run',
    distance: 5000,
    duration: 1_800_000,
    createdAt: new Date('2026-10-01'),
    privacy: 'everyone',
    kudos: [],
    comments: [],
    ...over,
  }) as SocialActivity;

describe('searchUsers', () => {
  const users = { a: user(ASHA, 'asha_runs'), b: user(ME, 'dev_cycles') };

  it('matches a username or a wallet, ignoring case', () => {
    expect(searchUsers(users, 'ASHA').map((u) => u.username)).toEqual(['asha_runs']);
    expect(searchUsers(users, '00aa').map((u) => u.username)).toEqual(['dev_cycles']);
    expect(searchUsers(users, 'nobody')).toEqual([]);
  });
});

describe('visibleActivities', () => {
  const following = new Set([ASHA]);

  it('hides private posts and shows follower-only ones only to followers', () => {
    const list = [
      post('public', {}),
      post('followers', { privacy: 'followers' }),
      post('private', { privacy: 'only_me' }),
    ];

    expect(visibleActivities(list, ME, following).map((a) => a.id)).toEqual([
      'public',
      'followers',
    ]);
    expect(visibleActivities(list, ME, new Set()).map((a) => a.id)).toEqual(['public']);
  });

  it('always shows an athlete their own posts, newest first', () => {
    const list = [
      post('old', { userId: ME, privacy: 'only_me', createdAt: new Date('2026-09-01') }),
      post('new', { userId: ME, createdAt: new Date('2026-10-02') }),
    ];

    expect(visibleActivities(list, ME, new Set()).map((a) => a.id)).toEqual(['new', 'old']);
  });
});

describe('searchActivities', () => {
  it('matches the name, or the sport when unnamed, among posts the viewer may see', () => {
    const posts = {
      a: post('a', { name: 'Morning tempo' }),
      b: post('b', { activityType: 'ride' }),
      c: post('c', { name: 'Secret tempo', privacy: 'only_me' }),
    };

    expect(searchActivities(posts, 'tempo', ME, new Set()).map((a) => a.id)).toEqual(['a']);
    expect(searchActivities(posts, 'ride', ME, new Set()).map((a) => a.id)).toEqual(['b']);
  });
});

describe('resolveUser', () => {
  const profile = {
    username: 'me_runs',
    firstName: 'Me',
    lastName: 'Runner',
    gender: 'prefer_not_to_say',
    birthday: null,
    wallet: ME,
    avatar: '',
    createdAt: 1_767_225_600_000,
    bio: '',
    location: '',
  } as Parameters<typeof resolveUser>[1]['profile'];

  const ctx = {
    users: { [ASHA]: user(ASHA, 'asha_runs') },
    me: ME,
    profile,
    myFollowerCount: 7,
    followingCount: 3,
  };

  it('returns another athlete as stored, or nothing when unknown', () => {
    expect(resolveUser(ASHA, ctx)?.username).toBe('asha_runs');
    expect(resolveUser('0x00000000000000000000000000000000000000cc', ctx)).toBeUndefined();
  });

  it('fills the viewer in from their own profile and follow counts', () => {
    expect(resolveUser(ME, ctx)).toMatchObject({
      username: 'me_runs',
      followers: 7,
      following: 3,
      avatar: undefined,
    });
  });
});
