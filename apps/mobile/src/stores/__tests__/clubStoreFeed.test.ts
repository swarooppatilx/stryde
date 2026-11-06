import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

const clubs = vi.hoisted(() => ({ getClubState: vi.fn(), getClubFeed: vi.fn() }));

vi.mock('@repo/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/shared')>();
  return { ...actual, services: { ...actual.services, clubs } };
});

installFakePlatform();
const { applyChange, useClubStore } = await import('@/stores/clubStore');
type ClubView = ReturnType<typeof useClubStore.getState>['clubs'][string];
type ClubState = NonNullable<ClubView['state']>;

const ME = '0x00000000000000000000000000000000000000aa' as const;
const BOB = '0x00000000000000000000000000000000000000bb' as const;
const CAL = '0x00000000000000000000000000000000000000cc' as const;

const baseState = (over: Partial<ClubState> = {}): ClubState => ({
  clubId: '1',
  owner: ME,
  settings: {
    name: 'Hill Club',
    location: '',
    description: '',
    photo: '',
    cover: '',
    inviteOnly: false,
    adminsOnlyPost: false,
    showLeaderboard: true,
  },
  admins: [],
  removed: [],
  requests: [],
  events: [],
  ...over,
});

const post = (id: string, comments: ClubView['feed'][number]['comments'] = []) => ({
  id,
  author: BOB,
  text: id,
  photos: [],
  announcement: false,
  createdAt: 1,
  comments,
});

const view = (over: Partial<ClubView> = {}): ClubView => ({
  state: baseState(),
  feed: [],
  loading: false,
  error: null,
  ...over,
});

beforeEach(() => {
  installFakePlatform();
  useClubStore.setState({ clubs: {} });
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('loading a club', () => {
  it('shows an empty, idle view for a club that was never loaded', () => {
    expect(useClubStore.getState().view('1')).toEqual({
      state: null,
      feed: [],
      loading: false,
      error: null,
    });
  });

  it('stores the club state and the latest 30 posts', async () => {
    clubs.getClubState.mockResolvedValueOnce(baseState());
    clubs.getClubFeed.mockResolvedValueOnce([post('p1')]);
    const loading = useClubStore.getState().load('1');
    expect(useClubStore.getState().view('1').loading).toBe(true);
    await loading;

    const loaded = useClubStore.getState().view('1');
    expect(loaded.state?.settings.name).toBe('Hill Club');
    expect(loaded.feed.map((p) => p.id)).toEqual(['p1']);
    expect(loaded.loading).toBe(false);
    expect(clubs.getClubFeed).toHaveBeenCalledWith('1', 30);
  });

  it('keeps what was loaded before and reports an error when a refresh fails, per club', async () => {
    clubs.getClubState.mockResolvedValueOnce(baseState());
    clubs.getClubFeed.mockResolvedValueOnce([post('p1')]);
    await useClubStore.getState().load('1');

    clubs.getClubState.mockRejectedValueOnce(new Error('offline'));
    clubs.getClubFeed.mockResolvedValueOnce([]);
    await useClubStore.getState().load('1');

    const failed = useClubStore.getState().view('1');
    expect(failed.error).toBe('Could not load the club');
    expect(failed.loading).toBe(false);
    expect(failed.feed.map((p) => p.id)).toEqual(['p1']);
    expect(useClubStore.getState().view('2').error).toBeNull();
  });

  it('clears an earlier error when a load starts', async () => {
    useClubStore.setState({ clubs: { '1': view({ error: 'old' }) } });
    clubs.getClubState.mockResolvedValueOnce(baseState());
    clubs.getClubFeed.mockResolvedValueOnce([]);
    await useClubStore.getState().load('1');
    expect(useClubStore.getState().view('1').error).toBeNull();
  });

  it('applies a local change to that club only', () => {
    useClubStore.setState({ clubs: { '1': view(), '2': view() } });
    useClubStore
      .getState()
      .applyLocal({ clubId: '1', action: 'post', data: { text: 'hey' }, clientId: 'c' }, ME);
    expect(useClubStore.getState().view('1').feed).toHaveLength(1);
    expect(useClubStore.getState().view('2').feed).toHaveLength(0);
  });

  it('can apply a change before the club has loaded', () => {
    useClubStore
      .getState()
      .applyLocal({ clubId: '5', action: 'post', data: { text: 'early' }, clientId: 'c' }, ME);
    expect(useClubStore.getState().view('5').feed[0]?.text).toBe('early');
    expect(useClubStore.getState().view('5').state).toBeNull();
  });
});

describe('applyChange feed changes', () => {
  it('records a post with its photos and announcement flag, defaulting the rest', () => {
    const full = applyChange(
      view(),
      {
        clubId: '1',
        action: 'post',
        data: { text: 'Race', photos: ['a'], announcement: true },
        clientId: 'x',
      },
      ME
    );
    expect(full.feed?.[0]).toMatchObject({
      text: 'Race',
      photos: ['a'],
      announcement: true,
      comments: [],
    });
    const bare = applyChange(view(), { clubId: '1', action: 'post', clientId: 'y' }, ME);
    expect(bare.feed?.[0]).toMatchObject({ text: '', photos: [], announcement: false });
  });

  it('puts the new post ahead of the existing ones', () => {
    const next = applyChange(
      view({ feed: [post('old')] }),
      { clubId: '1', action: 'post', data: { text: 'n' }, clientId: 'x' },
      ME
    );
    expect(next.feed?.map((p) => p.id)).toEqual(['local-x', 'old']);
  });

  it('deletes only the targeted post', () => {
    const next = applyChange(
      view({ feed: [post('a'), post('b')] }),
      { clubId: '1', action: 'delete-post', target: 'a' },
      ME
    );
    expect(next.feed?.map((p) => p.id)).toEqual(['b']);
  });

  it('adds a comment to the targeted post only', () => {
    const next = applyChange(
      view({ feed: [post('a'), post('b')] }),
      { clubId: '1', action: 'comment', target: 'b', data: { text: 'nice' }, clientId: 'c' },
      ME
    );
    expect(next.feed?.[0]?.comments).toEqual([]);
    expect(next.feed?.[1]?.comments).toEqual([
      expect.objectContaining({ id: 'local-c', postId: 'b', author: ME, text: 'nice' }),
    ]);
    const blank = applyChange(
      view({ feed: [post('a')] }),
      { clubId: '1', action: 'comment', target: 'a', clientId: 'd' },
      ME
    );
    expect(blank.feed?.[0]?.comments[0]?.text).toBe('');
  });

  it('removes a comment from whichever post has it', () => {
    const c = (id: string) => ({ id, postId: 'a', author: BOB, text: id, createdAt: 1 });
    const next = applyChange(
      view({ feed: [post('a', [c('k1'), c('k2')]), post('b', [c('k3')])] }),
      { clubId: '1', action: 'delete-comment', target: 'k1' },
      ME
    );
    expect(next.feed?.map((p) => p.comments.map((x) => x.id))).toEqual([['k2'], ['k3']]);
  });
});

describe('applyChange club state changes', () => {
  it('merges settings over the existing ones and builds them when the club has no state yet', () => {
    const merged = applyChange(
      view(),
      { clubId: '1', action: 'settings', data: { inviteOnly: true } },
      ME
    );
    expect(merged.state?.settings).toMatchObject({ name: 'Hill Club', inviteOnly: true });

    expect(
      applyChange(view({ state: null }), { clubId: '1', action: 'settings', data: {} }, ME)
    ).toEqual({});
  });

  it('makes and unmakes an admin without duplicating one', () => {
    const made = applyChange(
      view({ state: baseState({ admins: [CAL] }) }),
      { clubId: '1', action: 'set-role', target: CAL, data: { role: 'admin' } },
      ME
    );
    expect(made.state?.admins).toEqual([CAL]);

    const unmade = applyChange(
      view({ state: baseState({ admins: [CAL, BOB] }) }),
      { clubId: '1', action: 'set-role', target: CAL, data: { role: 'member' } },
      ME
    );
    expect(unmade.state?.admins).toEqual([BOB]);
  });

  it('files my join request as pending, replacing an older one of mine, and can cancel it', () => {
    const start = view({
      state: baseState({
        requests: [
          { member: ME, status: 'declined', at: 1 },
          { member: BOB, status: 'pending', at: 2 },
        ],
      }),
    });
    const asked = applyChange(start, { clubId: '1', action: 'request' }, ME);
    expect(asked.state?.requests.map((r) => [r.member, r.status])).toEqual([
      [BOB, 'pending'],
      [ME, 'pending'],
    ]);

    const cancelled = applyChange(start, { clubId: '1', action: 'cancel-request' }, ME);
    expect(cancelled.state?.requests.map((r) => r.member)).toEqual([BOB]);
  });

  it('declines a request when not approved, leaving other requests alone', () => {
    const start = view({
      state: baseState({
        requests: [
          { member: BOB, status: 'pending', at: 1 },
          { member: CAL, status: 'pending', at: 2 },
        ],
      }),
    });
    const next = applyChange(
      start,
      { clubId: '1', action: 'decide', target: BOB, data: { approve: false } },
      ME
    );
    expect(next.state?.requests.map((r) => r.status)).toEqual(['declined', 'pending']);
  });

  it('removes a member and strips their admin role, or reinstates them', () => {
    const start = view({ state: baseState({ admins: [BOB], removed: [] }) });
    const removed = applyChange(
      start,
      { clubId: '1', action: 'remove-member', target: BOB, data: {} },
      ME
    );
    expect(removed.state?.removed).toEqual([BOB]);
    expect(removed.state?.admins).toEqual([]);

    const back = applyChange(
      view({ state: baseState({ removed: [BOB, CAL] }) }),
      { clubId: '1', action: 'remove-member', target: BOB, data: { removed: false } },
      ME
    );
    expect(back.state?.removed).toEqual([CAL]);
  });

  it('links an event once and unlinks it', () => {
    const linked = applyChange(
      view({ state: baseState({ events: ['7'] }) }),
      { clubId: '1', action: 'link-event', target: '7' },
      ME
    );
    expect(linked.state?.events).toEqual(['7']);
    const more = applyChange(
      view({ state: baseState({ events: ['7'] }) }),
      { clubId: '1', action: 'link-event', target: '8' },
      ME
    );
    expect(more.state?.events).toEqual(['7', '8']);
    const gone = applyChange(
      view({ state: baseState({ events: ['7', '8'] }) }),
      { clubId: '1', action: 'unlink-event', target: '7' },
      ME
    );
    expect(gone.state?.events).toEqual(['8']);
  });

  it('changes nothing for actions that do not alter what is on screen, or before state loads', () => {
    expect(
      applyChange(view(), { clubId: '1', action: 'notify', data: { level: 'none' } }, ME)
    ).toEqual({});
    expect(
      applyChange(view({ state: null }), { clubId: '1', action: 'link-event', target: '7' }, ME)
    ).toEqual({});
  });
});
