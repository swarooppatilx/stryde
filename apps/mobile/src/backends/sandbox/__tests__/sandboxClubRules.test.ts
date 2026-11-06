import { describe, expect, it } from 'vitest';
import { SANDBOX_CLUB_MEMBERS } from '@/backends/sandbox/communitySeed';
import { createSandboxClubs, seededClubMembers } from '@/backends/sandbox/sandboxClubs';

const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;
const OWNER = addr(1);
const ADMIN = addr(2);
const MEMBER = addr(3);
const OTHER = addr(4);
const STRANGER = addr(9);

function encode(data: unknown): string {
  if (typeof data === 'string') return data;
  return data === undefined ? '' : JSON.stringify(data);
}

interface Answer {
  status: number;
  body: {
    club: ClubBody;
    posts: PostBody[];
    settings: Record<string, Record<string, unknown>>;
  } & Record<string, unknown>;
}
interface PostBody {
  id: string;
  text: string;
  author: string;
  comments: { author: string; text: string }[];
}
interface ClubBody {
  admins: string[];
  removed: string[];
  events: string[];
  requests: unknown[];
  settings: { name: string };
}

function setup() {
  let clock = 1_800_000_000;
  const clubs = createSandboxClubs({
    now: () => clock,
    owner: (id) => (id === '9001' ? OWNER : null),
    isMember: (_id, who) => who !== STRANGER,
  });
  const run = (
    actor: string,
    action: string,
    extra: { target?: string; data?: unknown; clientId?: string; clubId?: string } = {}
  ) => {
    const { data, clubId = '9001', ...rest } = extra;
    const result = clubs.handle('action', 'POST', new URLSearchParams(), {
      intent: {
        actor,
        clubId,
        action,
        clientId: 'c1',
        ...rest,
        data: encode(data),
      },
    });
    return result as { status: number; body: Record<string, unknown> };
  };
  const raw = (route: string, query = '') =>
    clubs.handle(route, 'GET', new URLSearchParams(query), null) as Answer | null;
  const get = (route: string, query = ''): Answer => {
    const answer = raw(route, query);
    if (!answer) throw new Error(`no answer for ${route}`);
    return answer;
  };
  return { run, get, raw, tick: (s: number) => (clock += s) };
}

describe('sandbox club posting', () => {
  it('rejects an unknown club and unknown actions', () => {
    const { run } = setup();
    expect(run(OWNER, 'post', { clubId: '1' })).toMatchObject({
      status: 404,
      body: { code: 'not_found' },
    });
    expect(run(OWNER, 'dance')).toMatchObject({ status: 400, body: { code: 'invalid' } });
  });

  it('rejects data that is not JSON', () => {
    const { run } = setup();
    expect(run(OWNER, 'post', { data: '{nope' })).toMatchObject({
      status: 400,
      body: { error: 'data must be a JSON object' },
    });
  });

  it('keeps removed members and strangers from posting or commenting', () => {
    const { run } = setup();
    expect(run(STRANGER, 'post', { data: { text: 'hi' } }).status).toBe(403);
    run(OWNER, 'remove-member', { target: MEMBER });
    expect(run(MEMBER, 'post', { data: { text: 'hi' } }).body.error).toBe('Join the club first');
    expect(run(MEMBER, 'comment', { target: 'x', data: { text: 'hi' } }).status).toBe(403);
  });

  it('trims the text, stores photos, and is idempotent on the client id', () => {
    const { run, get } = setup();
    const first = run(MEMBER, 'post', { data: { text: '  hello  ', photos: ['p1'] } });
    const again = run(MEMBER, 'post', { data: { text: 'different' }, clientId: 'c1' });
    expect(first.status).toBe(200);
    expect((first.body.post as { text: string; photos: string[] }).text).toBe('hello');
    expect((first.body.post as { photos: string[] }).photos).toEqual(['p1']);
    expect((again.body.post as { id: string }).id).toBe((first.body.post as { id: string }).id);
    const mine = get('9001/feed').body.posts.filter((p: { author: string }) => p.author === MEMBER);
    expect(mine).toHaveLength(1);
  });

  it('defaults missing text to empty and ignores a non-array photos value', () => {
    const { run } = setup();
    const post = run(MEMBER, 'post', { data: { photos: 'nope' } }).body.post as {
      text: string;
      photos: string[];
    };
    expect(post).toMatchObject({ text: '', photos: [] });
  });

  it('only lets admins post announcements, or anything when posting is admins-only', () => {
    const { run } = setup();
    expect(run(MEMBER, 'post', { data: { text: 'a', announcement: true } }).status).toBe(403);
    expect(run(OWNER, 'post', { data: { text: 'a', announcement: true } }).status).toBe(200);
    run(OWNER, 'settings', { data: { adminsOnlyPost: true } });
    expect(run(MEMBER, 'post', { data: { text: 'b' }, clientId: 'c2' }).body.error).toBe(
      'Only club admins can post here'
    );
    expect(run(OWNER, 'post', { data: { text: 'b' }, clientId: 'c2' }).status).toBe(200);
  });

  it('orders the feed newest first and honours the limit and default limit', () => {
    const { run, get, tick } = setup();
    run(MEMBER, 'post', { data: { text: 'one' }, clientId: 'a' });
    tick(10);
    run(MEMBER, 'post', { data: { text: 'two' }, clientId: 'b' });
    const feed = get('9001/feed', 'limit=1').body.posts;
    expect(feed).toHaveLength(1);
    expect(feed[0]?.text).toBe('two');
    expect(feed[0]).not.toHaveProperty('clientId');
    expect(feed[0]).not.toHaveProperty('clubId');
    expect(get('9001/feed').body.posts.length).toBeGreaterThan(2);
  });
});

describe('sandbox club comments and deletion', () => {
  it('refuses a comment on a missing post', () => {
    const { run } = setup();
    expect(run(MEMBER, 'comment', { target: 'nope', data: { text: 'x' } })).toMatchObject({
      status: 404,
      body: { error: 'That post is gone' },
    });
  });

  it('adds one comment per client id, oldest first on the post', () => {
    const { run, get, tick } = setup();
    const post = (
      run(MEMBER, 'post', { data: { text: 'p' }, clientId: 'p' }).body.post as {
        id: string;
      }
    ).id;
    const first = run(OTHER, 'comment', { target: post, data: { text: ' hi ' }, clientId: 'k' });
    const repeat = run(OTHER, 'comment', { target: post, data: { text: 'again' }, clientId: 'k' });
    tick(5);
    run(OWNER, 'comment', { target: post, data: {}, clientId: 'z' });
    expect((first.body.comment as { text: string }).text).toBe('hi');
    expect((repeat.body.comment as { id: string }).id).toBe(
      (first.body.comment as { id: string }).id
    );
    const comments =
      get('9001/feed').body.posts.find((p: { id: string }) => p.id === post)?.comments ?? [];
    expect(comments.map((c: { author: string; text: string }) => [c.author, c.text])).toEqual([
      [OTHER, 'hi'],
      [OWNER, ''],
    ]);
    expect(comments[0]).not.toHaveProperty('clientId');
  });

  it('lets authors and admins delete, but not other members', () => {
    const { run, get } = setup();
    const post = (
      run(MEMBER, 'post', { data: { text: 'p' }, clientId: 'p' }).body.post as {
        id: string;
      }
    ).id;
    expect(run(OTHER, 'delete-post', { target: post })).toMatchObject({
      status: 403,
      body: { error: 'You can only delete your own posts and comments' },
    });
    expect(run(MEMBER, 'delete-post', { target: post }).body).toEqual({ deleted: true });
    expect(get('9001/feed').body.posts.some((p: { id: string }) => p.id === post)).toBe(false);
  });

  it('removes a post’s comments with it and lets an admin delete a comment', () => {
    const { run, get } = setup();
    const post = (
      run(MEMBER, 'post', { data: { text: 'p' }, clientId: 'p' }).body.post as {
        id: string;
      }
    ).id;
    const comment = (
      run(OTHER, 'comment', { target: post, data: { text: 'c' }, clientId: 'c' }).body.comment as {
        id: string;
      }
    ).id;
    expect(run(MEMBER, 'delete-comment', { target: comment }).status).toBe(403);
    expect(run(OWNER, 'delete-comment', { target: comment }).body).toEqual({ deleted: true });
    run(OTHER, 'comment', { target: post, data: { text: 'c2' }, clientId: 'c2' });
    run(OWNER, 'delete-post', { target: post });
    const again = run(OWNER, 'delete-post', { target: post });
    expect(again.body).toEqual({ deleted: true });
    expect(get('9001/feed').body.posts.find((p: { id: string }) => p.id === post)).toBeUndefined();
  });

  it('treats deleting something already gone as success', () => {
    const { run } = setup();
    expect(run(MEMBER, 'delete-comment', { target: 'gone' }).body).toEqual({ deleted: true });
  });
});

describe('sandbox club roles, requests and events', () => {
  it('keeps settings and roles to admins and the owner', () => {
    const { run, get } = setup();
    expect(run(MEMBER, 'settings', { data: { name: 'x' } }).status).toBe(403);
    expect(run(OWNER, 'settings', { data: { name: 'Hill Club' } }).body).toMatchObject({
      settings: { name: 'Hill Club', inviteOnly: false, showLeaderboard: true },
    });
    expect(get('9001').body.club.settings.name).toBe('Hill Club');

    expect(run(ADMIN, 'set-role', { target: MEMBER, data: { role: 'admin' } }).status).toBe(403);
    expect(run(OWNER, 'set-role', { target: MEMBER, data: { role: 'admin' } }).body).toEqual({
      role: 'admin',
    });
    expect(get('9001').body.club.admins).toContain(MEMBER);
    run(OWNER, 'set-role', { target: MEMBER, data: { role: 'member' } });
    expect(get('9001').body.club.admins).not.toContain(MEMBER);
  });

  it('reports pending requests as they are and lets a declined one be raised again', () => {
    const { run, get } = setup();
    expect(run(MEMBER, 'request').body).toEqual({ status: 'pending' });
    expect(run(MEMBER, 'request').body).toEqual({ status: 'pending' });
    expect(run(MEMBER, 'decide', { target: MEMBER }).status).toBe(403);
    expect(run(OWNER, 'decide', { target: MEMBER, data: { approve: false } }).body).toEqual({
      status: 'declined',
    });
    expect(run(MEMBER, 'request').body).toEqual({ status: 'pending' });
    expect(get('9001').body.club.requests).toHaveLength(1);
    run(OWNER, 'decide', { target: MEMBER, data: { approve: true } });
    expect(run(MEMBER, 'request').body).toEqual({ status: 'approved' });
  });

  it('cannot decide a request that is not pending', () => {
    const { run } = setup();
    expect(run(OWNER, 'decide', { target: MEMBER })).toMatchObject({
      status: 404,
      body: { error: 'No request to decide' },
    });
    run(MEMBER, 'request');
    run(OWNER, 'decide', { target: MEMBER, data: { approve: true } });
    expect(run(OWNER, 'decide', { target: MEMBER }).status).toBe(404);
  });

  it('cancels a request and refuses removed members a new one', () => {
    const { run, get } = setup();
    run(MEMBER, 'request');
    expect(run(MEMBER, 'cancel-request').body).toEqual({ status: null });
    expect(get('9001').body.club.requests).toEqual([]);
    run(OWNER, 'remove-member', { target: MEMBER });
    expect(run(MEMBER, 'request')).toMatchObject({
      status: 403,
      body: { error: 'You were removed from this club' },
    });
  });

  it('removes and reinstates members, protecting the owner and admins', () => {
    const { run, get } = setup();
    run(OWNER, 'set-role', { target: ADMIN, data: { role: 'admin' } });
    expect(run(MEMBER, 'remove-member', { target: OTHER }).status).toBe(403);
    expect(run(ADMIN, 'remove-member', { target: OWNER }).body.error).toBe(
      'The owner cannot be removed'
    );
    expect(run(addr(5), 'remove-member', { target: ADMIN }).status).toBe(403);
    run(OWNER, 'set-role', { target: addr(5), data: { role: 'admin' } });
    expect(run(addr(5), 'remove-member', { target: ADMIN }).body.error).toBe(
      'Only the owner can remove an admin'
    );

    expect(run(OWNER, 'remove-member', { target: ADMIN }).body).toEqual({ removed: true });
    let club = get('9001').body.club;
    expect(club.removed).toEqual([ADMIN]);
    expect(club.admins).not.toContain(ADMIN);
    expect(run(OWNER, 'remove-member', { target: ADMIN, data: { removed: false } }).body).toEqual({
      removed: false,
    });
    club = get('9001').body.club;
    expect(club.removed).toEqual([]);
  });

  it('links and unlinks events for admins only', () => {
    const { run, get } = setup();
    expect(run(MEMBER, 'link-event', { target: '77' }).status).toBe(403);
    expect(run(OWNER, 'link-event', { target: '77' }).body).toEqual({ linked: true });
    expect(get('9001').body.club.events).toEqual(['9102', '77']);
    expect(run(OWNER, 'unlink-event', { target: '77' }).body).toEqual({ linked: false });
    expect(get('9001').body.club.events).toEqual(['9102']);
  });

  it('remembers notification levels per member, defaulting to all', () => {
    const { run, get } = setup();
    expect(get(`9001/notify/${MEMBER}`).body).toEqual({ level: 'all' });
    expect(run(MEMBER, 'notify', { data: { level: 'mentions' } }).body).toEqual({
      level: 'mentions',
    });
    expect(get(`9001/notify/${MEMBER.toUpperCase().replace('0X', '0x')}`).body.level).toBe(
      'mentions'
    );
    expect(get(`9001/notify/${OTHER}`).body.level).toBe('all');
  });
});

describe('sandbox club reads', () => {
  it('returns settings only for clubs that have saved some, with defaults filled in', () => {
    const { run, get } = setup();
    run(OWNER, 'settings', { data: { name: 'Hill Club' } });
    const body = get('settings', 'ids=9001,9002,').body;
    expect(Object.keys(body.settings)).toEqual(['9001']);
    expect(body.settings['9001']).toMatchObject({ name: 'Hill Club', adminsOnlyPost: false });
    expect(get('settings').body.settings).toEqual({});
  });

  it('answers 404 for unknown clubs and null for routes and methods it does not own', () => {
    const { get, raw } = setup();
    expect(get('1')).toMatchObject({ status: 404, body: { code: 'not_found' } });
    expect(raw('9001/mystery')).toBeNull();
    expect(raw('9001/notify')).toBeNull();
    expect(raw('')).toBeNull();
    const clubs = createSandboxClubs({ now: () => 1, owner: () => OWNER, isMember: () => true });
    expect(clubs.handle('9001', 'DELETE', new URLSearchParams(), null)).toBeNull();
  });

  it('answers a bodiless action as an unknown action', () => {
    const clubs = createSandboxClubs({ now: () => 1, owner: () => OWNER, isMember: () => true });
    expect(clubs.handle('action', 'POST', new URLSearchParams(), null)).toMatchObject({
      status: 400,
      body: { code: 'invalid' },
    });
  });
});

describe('seededClubMembers', () => {
  it('lowercases the seeded members and gives none for an unknown club', () => {
    const id = Object.keys(SANDBOX_CLUB_MEMBERS)[0] as string;
    expect(seededClubMembers(id)).toEqual(
      (SANDBOX_CLUB_MEMBERS[id] ?? []).map((m) => m.toLowerCase())
    );
    expect(seededClubMembers('nope')).toEqual([]);
  });
});
