import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOutbox, resetOutbox } from '@/backends/outbox/appOutbox';
import { clearCurrentUserId, setCurrentUserId } from '@/constants/currentUser';
import { at, type FakePlatform, installFakePlatform } from '@/platform/fakes';
import { setActiveWallet } from '@/services/wallet';
import type { SocialUser } from '@/utils/socialSelectors';
import { chainScopedStorageAdapter } from '@/utils/storage';

const setKudosOnChain = vi.hoisted(() => vi.fn());
const uploadComment = vi.hoisted(() => vi.fn());
const addCommentOnChain = vi.hoisted(() => vi.fn());
const syncAllActivitiesFromChain = vi.hoisted(() => vi.fn());
const syncSocialFromChain = vi.hoisted(() => vi.fn());
const setFollowing = vi.hoisted(() => vi.fn());
const getFollowing = vi.hoisted(() => vi.fn());
const getFollowers = vi.hoisted(() => vi.fn());
const setCommentLike = vi.hoisted(() => vi.fn());
const getCommentLikes = vi.hoisted(() => vi.fn());
const getAbout = vi.hoisted(() => vi.fn());
const getRegisteredUsers = vi.hoisted(() => vi.fn());

vi.mock('@repo/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/shared')>();
  return {
    ...actual,
    services: {
      ...actual.services,
      social: {
        ...actual.services.social,
        setKudos: setKudosOnChain,
        uploadCommentToIpfs: uploadComment,
        addComment: addCommentOnChain,
        syncSocialFromChain,
      },
      sync: { ...actual.services.sync, syncAllActivitiesFromChain },
      follows: { setFollowing, getFollowing, getFollowers },
      commentLikes: { setCommentLike, getCommentLikes },
      profileAbout: { ...actual.services.profileAbout, getAbout },
      profile: { ...actual.services.profile, getRegisteredUsers },
    },
  };
});

installFakePlatform();
const { resolveUser, searchActivities, searchUsers, useSocialStore } = await import(
  '@/stores/socialStore'
);
type SocialActivity = ReturnType<typeof useSocialStore.getState>['activities'][string];

const ME = '0xAbCdEf0000000000000000000000000000000001';
const OTHER = '0x0000000000000000000000000000000000000002';

function activity(overrides: Partial<SocialActivity> = {}): SocialActivity {
  return {
    id: 'act-1',
    userId: OTHER,
    activityType: 'run',
    distance: 5000,
    duration: 1_800_000,
    polyline: '',
    territory: null,
    territoryArea: 0,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    activityId: '5',
    kudos: [],
    comments: [],
    ...overrides,
  };
}

let platform: FakePlatform;

beforeEach(() => {
  platform = installFakePlatform();
  useSocialStore.setState({
    users: {},
    activities: {},
    currentUserKudos: new Set(),
    following: new Set(),
  });
  setCurrentUserId(ME);
  setActiveWallet({} as never, ME as `0x${string}`);
  setKudosOnChain.mockReset();
  uploadComment.mockReset().mockResolvedValue({ cid: 'bafy-c', size: 1 });
  addCommentOnChain.mockReset().mockResolvedValue({ txHash: '0x1', confirmed: true });
  resetOutbox();
  setFollowing.mockReset().mockResolvedValue({ following: true, created: true });
  getFollowing.mockReset().mockResolvedValue({ addresses: [], truncated: false });
  getFollowers.mockReset().mockResolvedValue({ addresses: [], truncated: false });
  setCommentLike.mockReset().mockResolvedValue({ liked: true, created: true });
  getCommentLikes.mockReset().mockResolvedValue({ likes: {}, truncated: false });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('restoring saved social state', () => {
  async function restoreFrom(version: number, state: Record<string, unknown>) {
    await chainScopedStorageAdapter.setItem('stryde-social', JSON.stringify({ state, version }));
    await useSocialStore.persist.rehydrate();
  }

  it('keeps who you follow and your kudos when upgrading from an older version', async () => {
    await restoreFrom(5, {
      users: {},
      activities: {},
      following: ['0xAAA', '0xBBB'],
      currentUserKudos: ['k1', 'k2'],
    });

    const { following, currentUserKudos } = useSocialStore.getState();
    expect([...following].sort()).toEqual(['0xaaa', '0xbbb']);
    expect([...currentUserKudos].sort()).toEqual(['k1', 'k2']);
  });

  it('restores the current version too, with follows normalised to lowercase', async () => {
    await restoreFrom(6, {
      users: {},
      activities: {},
      following: ['0xAAA'],
      currentUserKudos: ['k1'],
    });

    expect(useSocialStore.getState().following.has('0xaaa')).toBe(true);
    expect(useSocialStore.getState().currentUserKudos.has('k1')).toBe(true);
  });

  it('survives a save and reload', async () => {
    useSocialStore.getState().toggleFollow(OTHER);
    const socialKeys = () => platform.storage.keys().filter((k) => k.includes('stryde-social'));
    await vi.waitFor(() => expect(socialKeys()).toHaveLength(1));
    const key = at(socialKeys(), 0);
    const onDisk = platform.storage.peek(key) ?? '';

    // "Restart": memory is empty, disk still holds what the last session saved.
    useSocialStore.setState({ following: new Set() });
    await vi.waitFor(() => expect(platform.storage.peek(key)).not.toBe(onDisk));
    await platform.storage.setItem(key, onDisk);
    await useSocialStore.persist.rehydrate();

    expect(useSocialStore.getState().isFollowing(OTHER)).toBe(true);
  });
});

describe('giving kudos', () => {
  const revert = Object.assign(new Error('reverted'), { name: 'ContractFunctionRevertedError' });

  it('gives kudos at once and sends it from the outbox, filed under a lowercase id', async () => {
    useSocialStore.setState({ activities: { 'act-1': activity() } });
    setKudosOnChain.mockResolvedValue({ changed: true, confirmed: true });

    await useSocialStore.getState().toggleKudos('act-1');

    expect(useSocialStore.getState().activities['act-1']?.kudos).toEqual([ME.toLowerCase()]);
    expect(useSocialStore.getState().currentUserKudos.has('act-1')).toBe(true);

    await getOutbox().drain();

    expect(setKudosOnChain).toHaveBeenCalledWith(expect.anything(), 5n, true);
    expect(getOutbox().entries()).toEqual([]);
  });

  it('keeps the kudos on screen when the network fails, and keeps trying', async () => {
    useSocialStore.setState({ activities: { 'act-1': activity() } });
    setKudosOnChain.mockRejectedValue(new Error('rpc down'));

    await useSocialStore.getState().toggleKudos('act-1');
    await getOutbox().drain();

    expect(useSocialStore.getState().activities['act-1']?.kudos).toEqual([ME.toLowerCase()]);
    expect(getOutbox().entries()[0]).toMatchObject({ key: 'kudos:act-1', attempts: 1 });
  });

  // A mixed-case wallet id was stored lowercased on the way in but compared
  // case-sensitively on the way out, so a refused kudos stayed on screen.
  it('takes a kudos back off when the contract refuses it, even for a mixed-case wallet', async () => {
    useSocialStore.setState({ activities: { 'act-1': activity() } });
    setKudosOnChain.mockRejectedValue(revert);

    await useSocialStore.getState().toggleKudos('act-1');
    await getOutbox().drain();

    expect(useSocialStore.getState().activities['act-1']?.kudos).toEqual([]);
    expect(useSocialStore.getState().currentUserKudos.has('act-1')).toBe(false);
  });

  it('puts a refused un-kudos back, without changing the id casing', async () => {
    useSocialStore.setState({
      activities: { 'act-1': activity({ kudos: [ME.toLowerCase()] }) },
      currentUserKudos: new Set(['act-1']),
    });
    setKudosOnChain.mockRejectedValue(revert);

    await useSocialStore.getState().toggleKudos('act-1');
    await getOutbox().drain();

    expect(useSocialStore.getState().activities['act-1']?.kudos).toEqual([ME.toLowerCase()]);
    expect(useSocialStore.getState().currentUserKudos.has('act-1')).toBe(true);
  });

  it('keeps the kudos and waits when the activity is not onchain yet', async () => {
    useSocialStore.setState({ activities: { 'act-1': activity({ activityId: undefined }) } });

    await useSocialStore.getState().toggleKudos('act-1');
    await getOutbox().drain();

    expect(setKudosOnChain).not.toHaveBeenCalled();
    expect(useSocialStore.getState().activities['act-1']?.kudos).toEqual([ME.toLowerCase()]);
    expect(getOutbox().entries()).toHaveLength(1);
  });

  it('delivers a quick on-then-off in order, ending on the state that was last wanted', async () => {
    useSocialStore.setState({ activities: { 'act-1': activity() } });
    setKudosOnChain.mockResolvedValue({ changed: true, confirmed: true });

    await useSocialStore.getState().toggleKudos('act-1');
    await useSocialStore.getState().toggleKudos('act-1');
    await getOutbox().drain();

    expect(setKudosOnChain.mock.calls.map((call) => call[2])).toEqual([true, false]);
    expect(useSocialStore.getState().activities['act-1']?.kudos).toEqual([]);
    expect(getOutbox().entries()).toEqual([]);
  });
});

describe('commenting', () => {
  const refusal = (errorName: string) =>
    Object.assign(new Error(errorName), {
      name: 'ContractFunctionRevertedError',
      data: { errorName },
    });
  const comments = () => useSocialStore.getState().activities['act-1']?.comments ?? [];

  it('shows the comment at once and posts it from the outbox', async () => {
    useSocialStore.setState({ activities: { 'act-1': activity() } });

    await useSocialStore.getState().addComment('act-1', 'nice run');

    expect(comments().map((c) => c.text)).toEqual(['nice run']);
    await getOutbox().drain();

    expect(uploadComment).toHaveBeenCalledWith(expect.objectContaining({ text: 'nice run' }));
    expect(addCommentOnChain).toHaveBeenCalledWith(
      expect.anything(),
      5n,
      comments()[0]?.id,
      'bafy-c'
    );
    expect(getOutbox().entries()).toEqual([]);
  });

  it('keeps the comment when the network fails, and keeps trying', async () => {
    useSocialStore.setState({ activities: { 'act-1': activity() } });
    addCommentOnChain.mockRejectedValue(new Error('rpc down'));

    await useSocialStore.getState().addComment('act-1', 'nice run');
    await getOutbox().drain();

    expect(comments()).toHaveLength(1);
    expect(getOutbox().entries()[0]).toMatchObject({ attempts: 1 });
  });

  it('takes the comment back when the contract refuses it', async () => {
    useSocialStore.setState({ activities: { 'act-1': activity() } });
    addCommentOnChain.mockRejectedValue(refusal('CidTooLong'));

    await useSocialStore.getState().addComment('act-1', 'nice run');
    await getOutbox().drain();

    expect(comments()).toEqual([]);
    expect(getOutbox().entries()).toEqual([]);
  });

  it('counts a duplicate as delivered, so a retry after success never removes a posted comment', async () => {
    useSocialStore.setState({ activities: { 'act-1': activity() } });
    addCommentOnChain.mockRejectedValue(refusal('DuplicateComment'));

    await useSocialStore.getState().addComment('act-1', 'nice run');
    await getOutbox().drain();

    expect(comments()).toHaveLength(1);
    expect(getOutbox().entries()).toEqual([]);
  });

  it('keeps the comment and waits when the activity is not onchain yet', async () => {
    useSocialStore.setState({ activities: { 'act-1': activity({ activityId: undefined }) } });

    await useSocialStore.getState().addComment('act-1', 'nice run');
    await getOutbox().drain();

    expect(addCommentOnChain).not.toHaveBeenCalled();
    expect(comments()).toHaveLength(1);
    expect(getOutbox().entries()).toHaveLength(1);
  });
});

describe('following', () => {
  const user = (followers: number) => ({
    id: OTHER,
    username: 'other',
    followers,
    following: 0,
    createdAt: new Date(),
  });

  it('counts a follow and an unfollow', () => {
    useSocialStore.setState({ users: { [OTHER]: user(3) as never } });

    useSocialStore.getState().toggleFollow(OTHER);
    expect(useSocialStore.getState().users[OTHER]?.followers).toBe(4);

    useSocialStore.getState().toggleFollow(OTHER);
    expect(useSocialStore.getState().users[OTHER]?.followers).toBe(3);
  });

  it('never shows a negative follower count', () => {
    useSocialStore.setState({
      users: { [OTHER]: user(0) as never },
      following: new Set([OTHER]),
    });

    useSocialStore.getState().toggleFollow(OTHER);

    expect(useSocialStore.getState().users[OTHER]?.followers).toBe(0);
  });
});

describe('liking a comment', () => {
  const COMMENT = `0x${'11'.repeat(32)}`;
  const comment = (id: string, likedBy: string[] = []) => ({
    id,
    userId: OTHER,
    text: 'nice',
    createdAt: new Date(),
    likedBy,
  });
  const seed = (comments = [comment(COMMENT)]) =>
    useSocialStore.setState({ activities: { 'act-1': activity({ comments }) } });
  const likedBy = () => useSocialStore.getState().activities['act-1']?.comments[0]?.likedBy;

  it('shows the like at once and sends it, signed by the wallet, to the likes service', async () => {
    seed();

    const pending = useSocialStore.getState().toggleCommentLike('act-1', COMMENT);

    expect(likedBy()).toEqual([ME]);
    await pending;
    expect(setCommentLike).toHaveBeenCalledWith({}, COMMENT, true);
  });

  it('unlikes when already liked, whatever the letter case of the stored like', async () => {
    seed([comment(COMMENT, [ME.toLowerCase()])]);

    await useSocialStore.getState().toggleCommentLike('act-1', COMMENT);

    expect(likedBy()).toEqual([]);
    expect(setCommentLike).toHaveBeenCalledWith({}, COMMENT, false);
  });

  it('takes the like back and says so when the service refuses', async () => {
    seed();
    setCommentLike.mockRejectedValue(new Error('offline'));

    await useSocialStore.getState().toggleCommentLike('act-1', COMMENT);

    expect(likedBy()).toEqual([]);
  });

  it('keeps the like on this device for a comment still being posted, without calling the service', async () => {
    seed([comment('local-c')]);

    await useSocialStore.getState().toggleCommentLike('act-1', 'local-c');

    expect(likedBy()).toEqual([ME]);
    expect(setCommentLike).not.toHaveBeenCalled();
  });

  it('loads everyone’s likes from the service, replacing a stale local view', async () => {
    seed([comment(COMMENT, ['stale'])]);
    getCommentLikes.mockResolvedValue({
      likes: { [COMMENT]: [OTHER, ME.toLowerCase()] },
      truncated: false,
    });

    await useSocialStore.getState().loadCommentLikes();

    expect(getCommentLikes).toHaveBeenCalledWith([COMMENT]);
    expect(likedBy()).toEqual([OTHER, ME.toLowerCase()]);
  });

  it('does not let a refresh wipe a like that is still on its way to the service', async () => {
    seed();
    let finishSending: (value: unknown) => void = () => {};
    setCommentLike.mockReturnValue(new Promise((resolve) => (finishSending = resolve)));

    const sending = useSocialStore.getState().toggleCommentLike('act-1', COMMENT);
    // A refresh lands first, and the service does not know about the like yet.
    await useSocialStore.getState().loadCommentLikes();
    expect(likedBy()).toEqual([ME]);

    finishSending({ liked: true, created: true });
    await sending;
    getCommentLikes.mockResolvedValue({
      likes: { [COMMENT]: [ME.toLowerCase()] },
      truncated: false,
    });
    await useSocialStore.getState().loadCommentLikes();

    expect(likedBy()).toEqual([ME.toLowerCase()]);
  });

  it('asks about real comment ids only, and not at all when there are none', async () => {
    seed([comment('local-c')]);

    await useSocialStore.getState().loadCommentLikes();

    expect(getCommentLikes).not.toHaveBeenCalled();
  });

  it('asks for at most 100 comments per request', async () => {
    const many = Array.from({ length: 150 }, (_, i) =>
      comment(`0x${i.toString(16).padStart(64, '0')}`)
    );
    seed(many);

    await useSocialStore.getState().loadCommentLikes();

    expect(getCommentLikes.mock.calls.map((call) => call[0].length)).toEqual([100, 50]);
  });

  it('keeps what it had when the service cannot be reached', async () => {
    seed([comment(COMMENT, [OTHER])]);
    getCommentLikes.mockRejectedValue(new Error('down'));

    await useSocialStore.getState().loadCommentLikes();

    expect(likedBy()).toEqual([OTHER]);
  });
});

describe('signing out', () => {
  it('uses the signed-out placeholder identity', () => {
    clearCurrentUserId();
    useSocialStore.setState({ activities: { 'act-1': activity({ userId: 'current' }) } });

    expect(useSocialStore.getState().getFeed()).toHaveLength(1);
  });
});

describe('fetching the feed from the chain', () => {
  const HASH = `0x${'ab'.repeat(32)}`;
  const chainActivity = (hash: string, id: bigint) => ({
    activityHash: hash,
    owner: OTHER,
    activityId: id,
    activityType: 'run' as const,
    distance: 5000,
    duration: 1_800_000,
    territoryArea: 0,
    timestamp: 1_767_268_800,
    metadata: '',
  });

  it('skips an activity the user deleted on this device', async () => {
    const { useActivityStore } = await import('@/stores/activityStore');
    useActivityStore.setState({ activities: [], deletedHashes: [HASH] });
    syncAllActivitiesFromChain.mockResolvedValue([
      chainActivity(HASH, 1n),
      chainActivity(`0x${'cd'.repeat(32)}`, 2n),
    ]);
    syncSocialFromChain.mockResolvedValue({ kudos: [], comments: [] });

    await useSocialStore.getState().fetchActivities();

    const hashes = Object.values(useSocialStore.getState().activities).map((a) => a.activityHash);
    expect(hashes).not.toContain(HASH);
    expect(hashes).toContain(`0x${'cd'.repeat(32)}`);
  });
});

describe('refreshing the feed', () => {
  it('reports success, so the screen can stay quiet', async () => {
    syncAllActivitiesFromChain.mockResolvedValue([]);
    syncSocialFromChain.mockResolvedValue({ kudos: [], comments: [] });

    expect(await useSocialStore.getState().fetchActivities()).toBe(true);
  });

  it('reports failure and leaves the feed as it was, so the screen can say so', async () => {
    useSocialStore.setState({ activities: { 'act-1': activity() } });
    syncAllActivitiesFromChain.mockRejectedValue(new Error('rpc down'));

    const ok = await useSocialStore.getState().fetchActivities();

    expect(ok).toBe(false);
    expect(Object.keys(useSocialStore.getState().activities)).toEqual(['act-1']);
  });
});

describe('feed loading status', () => {
  beforeEach(() => useSocialStore.getState().reset());

  it('starts idle and becomes ready once the first load works', async () => {
    syncAllActivitiesFromChain.mockResolvedValue([]);
    syncSocialFromChain.mockResolvedValue({ kudos: [], comments: [] });

    expect(useSocialStore.getState().feedStatus).toBe('idle');

    await useSocialStore.getState().fetchActivities();

    expect(useSocialStore.getState().feedStatus).toBe('ready');
  });

  it('is an error when the first load fails, so the screen can offer a retry', async () => {
    syncAllActivitiesFromChain.mockRejectedValue(new Error('rpc down'));

    await useSocialStore.getState().fetchActivities();

    expect(useSocialStore.getState().feedStatus).toBe('error');
  });

  it('stays ready when a later refresh fails, since there is a feed to show', async () => {
    syncAllActivitiesFromChain.mockResolvedValue([]);
    syncSocialFromChain.mockResolvedValue({ kudos: [], comments: [] });
    await useSocialStore.getState().fetchActivities();
    syncAllActivitiesFromChain.mockRejectedValue(new Error('rpc down'));

    await useSocialStore.getState().fetchActivities();

    expect(useSocialStore.getState().feedStatus).toBe('ready');
  });
});

describe('following through the server', () => {
  const THEM_USER = {
    id: OTHER,
    username: 'them',
    firstName: '',
    lastName: '',
    gender: 'prefer_not_to_say',
    birthday: null,
    wallet: OTHER,
    isVerified: false,
    followers: 3,
    following: 0,
    createdAt: new Date(),
  };

  it('shows the follow at once and asks the server to record it', async () => {
    useSocialStore.setState({ users: { [OTHER]: THEM_USER as never } });

    const pending = useSocialStore.getState().toggleFollow(OTHER);

    expect(useSocialStore.getState().isFollowing(OTHER)).toBe(true);
    await pending;
    await getOutbox().drain();
    expect(setFollowing).toHaveBeenCalledWith({}, OTHER, true);
  });

  it('asks the server to remove an existing follow', async () => {
    useSocialStore.setState({ following: new Set([OTHER]) });

    await useSocialStore.getState().toggleFollow(OTHER);
    await getOutbox().drain();

    expect(setFollowing).toHaveBeenCalledWith({}, OTHER, false);
    expect(useSocialStore.getState().isFollowing(OTHER)).toBe(false);
  });

  it('keeps the follow on screen when the server cannot be reached, and keeps trying', async () => {
    useSocialStore.setState({ users: { [OTHER]: THEM_USER as never } });
    setFollowing.mockRejectedValue(new Error('offline'));

    await useSocialStore.getState().toggleFollow(OTHER);
    await getOutbox().drain();

    expect(useSocialStore.getState().isFollowing(OTHER)).toBe(true);
    expect(getOutbox().entries()[0]).toMatchObject({ key: `follow:${OTHER}`, attempts: 1 });
  });

  it('puts everything back when the server refuses for good', async () => {
    useSocialStore.setState({ users: { [OTHER]: THEM_USER as never } });
    setFollowing.mockRejectedValue(Object.assign(new Error('bad signature'), { status: 401 }));

    await useSocialStore.getState().toggleFollow(OTHER);
    await getOutbox().drain();

    expect(useSocialStore.getState().isFollowing(OTHER)).toBe(false);
    expect(useSocialStore.getState().users[OTHER]?.followers).toBe(3);
  });

  it('puts an unfollow back when the server refuses for good', async () => {
    useSocialStore.setState({ following: new Set([OTHER]) });
    setFollowing.mockRejectedValue(Object.assign(new Error('nope'), { status: 403 }));

    await useSocialStore.getState().toggleFollow(OTHER);
    await getOutbox().drain();

    expect(useSocialStore.getState().isFollowing(OTHER)).toBe(true);
  });

  it('keeps the follow and waits when there is no wallet yet, then sends it once there is', async () => {
    setActiveWallet(null, null);

    await useSocialStore.getState().toggleFollow(OTHER);
    await getOutbox().drain();

    expect(setFollowing).not.toHaveBeenCalled();
    expect(useSocialStore.getState().isFollowing(OTHER)).toBe(true);
    expect(getOutbox().entries()).toHaveLength(1);

    setActiveWallet({} as never, ME as `0x${string}`);
    getOutbox().entries();
    await getOutbox().retry(getOutbox().entries()[0]?.id ?? '');
    await getOutbox().drain();

    expect(setFollowing).toHaveBeenCalledWith({}, OTHER, true);
    expect(getOutbox().entries()).toEqual([]);
  });

  it('refuses to follow yourself, so nothing is signed and no state flips', async () => {
    await useSocialStore.getState().toggleFollow(ME);

    expect(setFollowing).not.toHaveBeenCalled();
    expect(useSocialStore.getState().isFollowing(ME)).toBe(false);
  });
});

describe('loading the follow graph', () => {
  it('replaces the local follow set with what the server has, and counts my followers', async () => {
    useSocialStore.setState({ following: new Set(['0xstale']) });
    getFollowing.mockResolvedValue({ addresses: [OTHER], truncated: false });
    getFollowers.mockResolvedValue({
      addresses: [OTHER, '0xthird'],
      entries: [
        { address: OTHER, followedAt: 1_700_000_000 },
        { address: '0xthird', followedAt: 0 },
      ],
      truncated: false,
    });

    await useSocialStore.getState().syncFollowing(ME as `0x${string}`);

    expect([...useSocialStore.getState().following]).toEqual([OTHER]);
    expect(useSocialStore.getState().myFollowerCount).toBe(2);
    expect(useSocialStore.getState().followerEntries).toEqual([
      { address: OTHER, followedAt: 1_700_000_000 },
      { address: '0xthird', followedAt: 0 },
    ]);
  });

  it('remembers the newest thing the athlete has seen in the inbox, not what the phone clock says', () => {
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    const newest = Date.parse('2024-05-01T10:00:00Z');

    useSocialStore.getState().markInboxSeen(newest);

    expect(useSocialStore.getState().inboxSeenAt).toBe(newest);
  });

  it('never moves what has been seen backwards', () => {
    useSocialStore.getState().reset();
    useSocialStore.getState().markInboxSeen(2000);
    useSocialStore.getState().markInboxSeen(1000);

    expect(useSocialStore.getState().inboxSeenAt).toBe(2000);
  });

  it('keeps what it had when the server cannot be reached', async () => {
    useSocialStore.setState({ following: new Set([OTHER]) });
    getFollowing.mockRejectedValue(new Error('offline'));

    await useSocialStore.getState().syncFollowing(ME as `0x${string}`);

    expect(useSocialStore.getState().isFollowing(OTHER)).toBe(true);
  });

  it('fills in another athlete\u2019s follower and following counts', async () => {
    useSocialStore.setState({
      users: {
        [OTHER]: {
          id: OTHER,
          username: 'them',
          followers: 0,
          following: 0,
        } as never,
      },
    });
    getFollowers.mockResolvedValue({ addresses: ['0x1', '0x2', '0x3'], truncated: false });
    getFollowing.mockResolvedValue({ addresses: ['0x4'], truncated: false });

    await useSocialStore.getState().loadFollowStats(OTHER as `0x${string}`);

    expect(useSocialStore.getState().users[OTHER]).toMatchObject({ followers: 3, following: 1 });
  });
});

describe('athlete bios', () => {
  const someone = (id: string) =>
    ({ id, username: id.slice(-2), followers: 0, following: 0 }) as unknown as SocialUser;

  beforeEach(() => {
    getAbout.mockReset();
    getRegisteredUsers.mockReset();
  });

  it('fills in the bio and location of the athletes it asks about', async () => {
    useSocialStore.setState({ users: { [OTHER]: someone(OTHER) } });
    getAbout.mockResolvedValue({ [OTHER]: { bio: 'Trail runner', location: 'Pune' } });

    await useSocialStore.getState().loadAbout([OTHER]);

    expect(useSocialStore.getState().users[OTHER]).toMatchObject({
      bio: 'Trail runner',
      location: 'Pune',
    });
  });

  it('asks in batches the server accepts', async () => {
    const wallets = Array.from(
      { length: 250 },
      (_, i) => `0x${(i + 1).toString(16).padStart(40, '0')}`
    );
    getAbout.mockResolvedValue({});

    await useSocialStore.getState().loadAbout(wallets);

    expect(getAbout.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 50]);
  });

  it('keeps what it had when the server cannot be reached', async () => {
    useSocialStore.setState({
      users: { [OTHER]: { ...someone(OTHER), bio: 'kept' } },
    });
    getAbout.mockRejectedValue(new Error('offline'));

    await useSocialStore.getState().loadAbout([OTHER]);

    expect(useSocialStore.getState().users[OTHER]).toMatchObject({ bio: 'kept' });
  });

  it('does not lose the bios when the athlete list is refreshed from the chain', async () => {
    useSocialStore.setState({ users: { [OTHER]: someone(OTHER) } });
    getAbout.mockResolvedValue({ [OTHER]: { bio: 'Trail runner', location: '' } });
    await useSocialStore.getState().loadAbout([OTHER]);
    getRegisteredUsers.mockResolvedValue([
      { wallet: OTHER, username: 'them', isVerified: false, avatarCid: null },
    ]);

    await useSocialStore.getState().fetchUsers();

    expect(useSocialStore.getState().users[OTHER]).toMatchObject({ bio: 'Trail runner' });
  });
});

describe('resolveUser', () => {
  const profile = {
    username: 'me',
    firstName: 'Ada',
    lastName: '',
    gender: 'prefer_not_to_say' as const,
    birthday: null,
    wallet: ME,
    avatar: '',
    createdAt: 0,
    bio: '',
    location: '',
  };

  it('shows the viewer’s own bio and location, and nobody else’s on their screen', () => {
    const me = resolveUser(ME, {
      users: {},
      me: ME,
      profile: { ...profile, bio: 'Trail runner', location: 'Pune' },
      myFollowerCount: 0,
      followingCount: 0,
    });
    const them = resolveUser(OTHER, {
      users: { [OTHER]: { id: OTHER, username: 'them', bio: 'theirs' } as never },
      me: ME,
      profile: { ...profile, bio: 'Trail runner', location: 'Pune' },
      myFollowerCount: 0,
      followingCount: 0,
    });

    expect(me).toMatchObject({ bio: 'Trail runner', location: 'Pune' });
    expect(them?.bio).toBe('theirs');
  });

  it('leaves the bio empty when the viewer has none', () => {
    const me = resolveUser(ME, {
      users: {},
      me: ME,
      profile: { ...profile, bio: '', location: '' },
      myFollowerCount: 0,
      followingCount: 0,
    });

    expect(me?.bio).toBeUndefined();
    expect(me?.location).toBeUndefined();
  });

  it('fills the viewer in from their own profile and live follow counts, whatever the address case', () => {
    const user = resolveUser(ME.toUpperCase().replace('0X', '0x'), {
      users: {},
      me: ME,
      profile,
      myFollowerCount: 3,
      followingCount: 2,
    });

    expect(user).toMatchObject({ username: 'me', followers: 3, following: 2 });
  });

  it('returns another athlete as loaded, or nothing before users load', () => {
    const ctx = { me: ME, profile, myFollowerCount: 0, followingCount: 0 };
    expect(resolveUser(OTHER, { ...ctx, users: {} })).toBeUndefined();
    expect(
      resolveUser(OTHER, {
        ...ctx,
        users: {
          [OTHER]: {
            id: OTHER,
            username: 'them',
            firstName: '',
            lastName: '',
            gender: 'prefer_not_to_say',
            birthday: null,
            wallet: OTHER,
            createdAt: new Date(0),
            followers: 1,
            following: 0,
          },
        },
      })?.username
    ).toBe('them');
  });
});

describe('search', () => {
  const them = {
    id: OTHER,
    username: 'Runner42',
    firstName: '',
    lastName: '',
    gender: 'prefer_not_to_say' as const,
    birthday: null,
    wallet: OTHER,
    createdAt: new Date(0),
    followers: 0,
    following: 0,
  };

  it('finds athletes by username or wallet, ignoring case', () => {
    const users = { [OTHER]: them };
    expect(searchUsers(users, 'runner')).toEqual([them]);
    expect(searchUsers(users, OTHER.slice(0, 8))).toEqual([them]);
    expect(searchUsers(users, 'nobody')).toEqual([]);
  });

  it('never surfaces a followers-only post to someone who does not follow its author', () => {
    const post = {
      id: 'p1',
      userId: OTHER,
      name: 'Sunrise run',
      activityType: 'run' as const,
      distance: 1,
      duration: 1,
      polyline: '',
      territory: null,
      territoryArea: 0,
      privacy: 'followers' as const,
      createdAt: new Date(0),
      kudos: [],
      comments: [],
    };
    const activities = { p1: post };

    expect(searchActivities(activities, 'sunrise', ME, new Set())).toEqual([]);
    expect(searchActivities(activities, 'sunrise', ME, new Set([OTHER]))).toEqual([post]);
  });
});
