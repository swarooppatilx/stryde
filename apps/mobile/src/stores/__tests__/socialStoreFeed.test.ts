import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCurrentUserId, setCurrentUserId } from '@/constants/currentUser';
import { installFakePlatform } from '@/platform/fakes';
import { useActivityStore } from '@/stores/activityStore';
import type { SocialActivity, SocialUser } from '@/utils/socialSelectors';

const syncAllActivitiesFromChain = vi.hoisted(() => vi.fn());
const syncSocialFromChain = vi.hoisted(() => vi.fn());
const getCommentLikes = vi.hoisted(() => vi.fn());
const getAbout = vi.hoisted(() => vi.fn());
const getRegisteredUsers = vi.hoisted(() => vi.fn());

vi.mock('@repo/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/shared')>();
  return {
    ...actual,
    services: {
      ...actual.services,
      social: { ...actual.services.social, syncSocialFromChain },
      sync: { ...actual.services.sync, syncAllActivitiesFromChain },
      commentLikes: { getCommentLikes, setCommentLike: vi.fn() },
      profileAbout: { ...actual.services.profileAbout, getAbout },
      profile: { ...actual.services.profile, getRegisteredUsers },
    },
  };
});

installFakePlatform();
const { useSocialStore } = await import('@/stores/socialStore');

const ME = '0x00000000000000000000000000000000000000aa';
const A = '0x00000000000000000000000000000000000000a1';
const B = '0x00000000000000000000000000000000000000b2';
const DAY = 86_400_000;

const user = (id: string, over: Partial<SocialUser> = {}): SocialUser => ({
  id,
  username: id.slice(-2),
  firstName: '',
  lastName: '',
  gender: 'prefer_not_to_say',
  birthday: null,
  wallet: id,
  createdAt: new Date(0),
  followers: 0,
  following: 0,
  ...over,
});

const post = (id: string, over: Partial<SocialActivity> = {}): SocialActivity => ({
  id,
  userId: A,
  activityType: 'run',
  distance: 1000,
  duration: 1000,
  polyline: '',
  territory: null,
  territoryArea: 0,
  createdAt: new Date(),
  kudos: [],
  comments: [],
  ...over,
});

const chainActivity = (hash: string, id: bigint, owner = A) => ({
  activityHash: hash,
  activityId: id,
  owner,
  activityType: 'run',
  distance: 5000,
  duration: 1800,
  territoryArea: 0,
  timestamp: 1_800_000_000,
  metadataName: 'Morning run',
});

beforeEach(() => {
  installFakePlatform();
  useSocialStore.getState().reset();
  useActivityStore.setState({ activities: [], deletedHashes: [] });
  setCurrentUserId(ME);
  vi.clearAllMocks();
  syncSocialFromChain.mockResolvedValue({ kudos: [], comments: [] });
  getCommentLikes.mockResolvedValue({ likes: {}, truncated: false });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('the athlete list', () => {
  it('loads registered athletes, turning avatar cids into links, and keeps known bios', async () => {
    useSocialStore.setState({ about: { [A]: { bio: 'Hills', location: 'Pune' } } });
    getRegisteredUsers.mockResolvedValueOnce([
      { wallet: A, username: 'asha', avatarCid: 'bafyavatar', isVerified: true },
      { wallet: B, username: 'ben', avatarCid: '', isVerified: false },
    ]);

    expect(await useSocialStore.getState().fetchUsers()).toBe(true);

    const { users } = useSocialStore.getState();
    expect(users[A]).toMatchObject({ username: 'asha', isVerified: true, bio: 'Hills' });
    expect(users[A]?.avatar).toContain('bafyavatar');
    expect(users[B]?.avatar).toBeUndefined();
  });

  it('says so and keeps the list when it cannot be loaded', async () => {
    useSocialStore.setState({ users: { [A]: user(A) } });
    getRegisteredUsers.mockRejectedValueOnce(new Error('down'));
    expect(await useSocialStore.getState().fetchUsers()).toBe(false);
    expect(Object.keys(useSocialStore.getState().users)).toEqual([A]);
  });
});

describe('bios', () => {
  it('asks for each address once, in lowercase, and records people with no bio as empty', async () => {
    getAbout.mockResolvedValueOnce({ [A]: { bio: 'Hi', location: 'Goa' } });
    useSocialStore.setState({ users: { [A]: user(A), [B]: user(B, { bio: 'stale' }) } });

    await useSocialStore.getState().loadAbout([A.toUpperCase().replace('0X', '0x'), A, B]);

    expect(getAbout).toHaveBeenCalledTimes(1);
    expect(getAbout).toHaveBeenCalledWith([A, B]);
    const { about, users } = useSocialStore.getState();
    expect(about[A]).toEqual({ bio: 'Hi', location: 'Goa' });
    expect(about[B]).toEqual({ bio: '', location: '' });
    expect(users[B]?.bio).toBeUndefined();
  });

  it('splits more than 100 addresses into separate requests', async () => {
    getAbout.mockResolvedValue({});
    const many = Array.from({ length: 205 }, (_, i) => `0x${i.toString(16).padStart(40, '0')}`);
    await useSocialStore.getState().loadAbout(many);
    expect(getAbout.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 5]);
  });

  it('keeps what it has when the service fails', async () => {
    useSocialStore.setState({ about: { [A]: { bio: 'keep', location: '' } } });
    getAbout.mockRejectedValueOnce(new Error('down'));
    await useSocialStore.getState().loadAbout([A]);
    expect(useSocialStore.getState().about[A]?.bio).toBe('keep');
  });
});

describe('refreshing the feed from the chain', () => {
  it('shows a loading state on the first load and ready after, with kudos attributed to me', async () => {
    syncAllActivitiesFromChain.mockResolvedValueOnce([chainActivity('0xH1', 1n)]);
    syncSocialFromChain.mockResolvedValueOnce({
      kudos: [{ activityId: 1n, giver: ME.toUpperCase().replace('0X', '0x') }],
      comments: [],
    });

    const pending = useSocialStore.getState().fetchActivities();
    expect(useSocialStore.getState().feedStatus).toBe('loading');
    expect(await pending).toBe(true);

    const state = useSocialStore.getState();
    expect(state.feedStatus).toBe('ready');
    expect(state.activities['0xh1']).toMatchObject({ name: 'Morning run', activityId: '1' });
    expect([...state.currentUserKudos]).toEqual(['0xH1']);
  });

  it('flags an error only on the first failed load, and leaves a ready feed alone on a failed refresh', async () => {
    syncAllActivitiesFromChain.mockRejectedValueOnce(new Error('rpc'));
    expect(await useSocialStore.getState().fetchActivities()).toBe(false);
    expect(useSocialStore.getState().feedStatus).toBe('error');

    syncAllActivitiesFromChain.mockResolvedValueOnce([chainActivity('0xH1', 1n)]);
    await useSocialStore.getState().fetchActivities();
    syncAllActivitiesFromChain.mockRejectedValueOnce(new Error('rpc'));
    expect(await useSocialStore.getState().fetchActivities()).toBe(false);
    expect(useSocialStore.getState().feedStatus).toBe('ready');
    expect(Object.keys(useSocialStore.getState().activities)).toEqual(['0xh1']);
  });

  it('still builds the feed when the social data cannot be read', async () => {
    syncAllActivitiesFromChain.mockResolvedValueOnce([chainActivity('0xH1', 1n)]);
    syncSocialFromChain.mockRejectedValueOnce(new Error('graph down'));
    expect(await useSocialStore.getState().fetchActivities()).toBe(true);
    expect(useSocialStore.getState().activities['0xh1']?.kudos).toEqual([]);
  });

  it('does not bring back an activity the user deleted, whatever the hash casing', async () => {
    useActivityStore.setState({ deletedHashes: ['0xh2'] });
    syncAllActivitiesFromChain.mockResolvedValueOnce([
      chainActivity('0xH1', 1n),
      chainActivity('0xH2', 2n),
    ]);
    await useSocialStore.getState().fetchActivities();
    expect(Object.keys(useSocialStore.getState().activities)).toEqual(['0xh1']);
  });

  it('keeps the viewer’s own device activities in the feed, ahead of the chain catching up', async () => {
    useActivityStore.setState({
      activities: [
        {
          ...post('local-1', { userId: ME }),
          activityHash: '0xLOCAL',
        },
      ],
    });
    syncAllActivitiesFromChain.mockResolvedValueOnce([chainActivity('0xH1', 1n)]);
    await useSocialStore.getState().fetchActivities();
    expect(Object.keys(useSocialStore.getState().activities).sort()).toEqual(['0xh1', '0xlocal']);
  });

  it('merges device activities into the feed on demand', () => {
    useActivityStore.setState({ activities: [post('local-1', { userId: ME })] });
    useSocialStore.getState().syncLocalActivities();
    expect(useSocialStore.getState().activities['local-1']?.userId).toBe(ME);
  });
});

describe('editing the feed', () => {
  it('updates one post by id or hash, and does nothing for an unknown one', () => {
    useSocialStore.setState({
      activities: { '0xh1': post('0xH1', { activityHash: '0xH1', name: 'old' }) },
    });
    const { updateActivity } = useSocialStore.getState();
    updateActivity('0xH1', { name: 'new' });
    expect(useSocialStore.getState().activities['0xh1']?.name).toBe('new');

    const before = useSocialStore.getState().activities;
    updateActivity('missing', { name: 'x' });
    expect(useSocialStore.getState().activities).toBe(before);
  });

  it('removes a post by hash, case-insensitively, or by id', () => {
    useSocialStore.setState({
      activities: {
        '0xh1': post('p1', { activityHash: '0xH1' }),
        '0xh2': post('p2', { activityHash: '0xH2' }),
        '0xh3': post('p3'),
      },
    });
    const { removeActivity } = useSocialStore.getState();
    removeActivity('0xh1', 'nothing');
    expect(Object.keys(useSocialStore.getState().activities)).toEqual(['0xh2', '0xh3']);
    removeActivity('0xnone', 'p3');
    expect(Object.keys(useSocialStore.getState().activities)).toEqual(['0xh2']);
  });

  it('never moves the inbox marker backwards', () => {
    const { markInboxSeen } = useSocialStore.getState();
    markInboxSeen(500);
    markInboxSeen(100);
    expect(useSocialStore.getState().inboxSeenAt).toBe(500);
  });

  it('resets everything', () => {
    useSocialStore.setState({
      users: { [A]: user(A) },
      following: new Set([A]),
      inboxSeenAt: 9,
      feedStatus: 'ready',
      myFollowerCount: 4,
    });
    useSocialStore.getState().reset();
    const state = useSocialStore.getState();
    expect(state.users).toEqual({});
    expect(state.following.size).toBe(0);
    expect(state.inboxSeenAt).toBe(0);
    expect(state.feedStatus).toBe('idle');
    expect(state.myFollowerCount).toBe(0);
  });
});

describe('what the viewer sees', () => {
  it('shows my posts, public posts and followed followers-only posts, and hides the rest', () => {
    useSocialStore.setState({
      following: new Set([A]),
      activities: {
        mine: post('mine', { userId: ME, privacy: 'only_me' }),
        pub: post('pub', { userId: B }),
        fol: post('fol', { userId: A, privacy: 'followers' }),
        notFol: post('notFol', { userId: B, privacy: 'followers' }),
        secret: post('secret', { userId: A, privacy: 'only_me' }),
      },
    });
    expect(
      useSocialStore
        .getState()
        .getFeed()
        .map((a) => a.id)
        .sort()
    ).toEqual(['fol', 'mine', 'pub']);
  });

  it('recommends active, followed-not athletes first, never me or people already followed', () => {
    clearCurrentUserId();
    setCurrentUserId(ME);
    const C = '0x00000000000000000000000000000000000000c3';
    const D = '0x00000000000000000000000000000000000000d4';
    useSocialStore.setState({
      following: new Set([D.toUpperCase().replace('0X', '0x')]),
      users: {
        [ME]: user(ME),
        [A]: user(A, { username: 'zed' }),
        [B]: user(B, { username: 'amy', avatar: 'http://img' }),
        [C]: user(C, { username: 'bob' }),
        [D]: user(D),
      },
      activities: {
        a1: post('a1', { userId: A, territoryArea: 5, createdAt: new Date(Date.now() - DAY) }),
        a2: post('a2', { userId: A, createdAt: new Date(Date.now() - 2 * DAY) }),
        a3: post('a3', { userId: A, createdAt: new Date(Date.now() - 3 * DAY) }),
        b1: post('b1', { userId: B, createdAt: new Date(Date.now() - 60 * DAY) }),
      },
    });

    expect(
      useSocialStore
        .getState()
        .getSuggestions()
        .map((u) => u.username)
    ).toEqual(['zed', 'amy', 'bob']);
  });

  it('breaks score ties by most recent activity, then name, and caps the list at ten', () => {
    const ids = Array.from(
      { length: 12 },
      (_, i) => `0x${(i + 16).toString(16).padStart(40, '0')}`
    );
    useSocialStore.setState({
      users: Object.fromEntries(ids.map((id, i) => [id, user(id, { username: `n${i}` })])),
      activities: {
        old: post('old', { userId: ids[5] as string, createdAt: new Date(Date.now() - 100 * DAY) }),
        older: post('older', {
          userId: ids[2] as string,
          createdAt: new Date(Date.now() - 200 * DAY),
        }),
      },
    });
    const names = useSocialStore
      .getState()
      .getSuggestions()
      .map((u) => u.username);
    expect(names).toHaveLength(10);
    expect(names.slice(0, 2)).toEqual(['n5', 'n2']);
    expect(names.slice(2)).toEqual(['n0', 'n1', 'n10', 'n11', 'n3', 'n4', 'n6', 'n7']);
  });
});
