/**
 * The club API answered on the device, for the Sandbox profile. Same routes and answers as
 * packages/api/src/routes/clubs.ts, kept in memory, with the main permission rules but no
 * signature checks. Dev builds only.
 */
import { SANDBOX_CLUB_MEMBERS, SANDBOX_DHANYA } from './communitySeed';

type Json = Record<string, unknown>;

interface Post {
  id: string;
  clubId: string;
  author: string;
  text: string;
  photos: string[];
  announcement: boolean;
  createdAt: number;
  clientId: string;
}
interface Comment {
  id: string;
  postId: string;
  clubId: string;
  author: string;
  text: string;
  createdAt: number;
  clientId: string;
}
interface ClubData {
  settings: Json | null;
  admins: Set<string>;
  removed: Set<string>;
  requests: Map<string, { status: string; at: number }>;
  events: Set<string>;
  notify: Map<string, string>;
}

export interface SandboxClubDeps {
  now: () => number;
  /** The club's owner, from the app's seeded clubs; null for an unknown club. */
  owner(clubId: string): string | null;
  /** Whether this wallet belongs to the club. */
  isMember(clubId: string, member: string): boolean;
}

const DEFAULT_SETTINGS = {
  name: '',
  location: '',
  description: '',
  photo: '',
  cover: '',
  inviteOnly: false,
  adminsOnlyPost: false,
  showLeaderboard: true,
};

const hex = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;

export function createSandboxClubs(deps: SandboxClubDeps) {
  const clubs = new Map<string, ClubData>();
  const posts: Post[] = [];
  const comments: Comment[] = [];
  let next = 1;

  const club = (id: string): ClubData => {
    let data = clubs.get(id);
    if (!data) {
      data = {
        settings: null,
        admins: new Set(),
        removed: new Set(),
        requests: new Map(),
        events: new Set(),
        notify: new Map(),
      };
      clubs.set(id, data);
    }
    return data;
  };

  // A lived-in club to open: an admin, a few posts and a comment.
  const t = deps.now();
  club('9001').admins.add(SANDBOX_DHANYA);
  club('9001').events.add('9102');
  const seedPost = (
    clubId: string,
    author: string,
    text: string,
    ago: number,
    announcement = false
  ) => {
    const post = {
      id: `sbx-club-post-${next++}`,
      clubId,
      author,
      text,
      photos: [],
      announcement,
      createdAt: t - ago,
      clientId: '',
    };
    posts.push(post);
    return post;
  };
  seedPost(
    '9001',
    hex(1),
    'Saturday long run moves to 6:00 so we beat the heat. Meet at the main gate.',
    3 * 3600,
    true
  );
  const tempo = seedPost('9001', hex(4), 'Anyone up for tempo intervals on Thursday?', 26 * 3600);
  comments.push({
    id: `sbx-club-comment-${next++}`,
    postId: tempo.id,
    clubId: '9001',
    author: hex(3),
    text: 'Count me in!',
    createdAt: t - 20 * 3600,
    clientId: '',
  });
  seedPost(
    '9002',
    hex(2),
    'Sinhagad climb this weekend. Lights and a spare tube, please.',
    5 * 3600,
    true
  );

  const state = (id: string) => {
    const data = club(id);
    return {
      clubId: id,
      owner: deps.owner(id),
      settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
      admins: [...data.admins],
      removed: [...data.removed],
      requests: [...data.requests.entries()].map(([member, r]) => ({
        member,
        status: r.status,
        at: r.at,
      })),
      events: [...data.events],
    };
  };

  const feed = (id: string, limit: number) =>
    posts
      .filter((p) => p.clubId === id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map(({ clubId: _c, clientId: _k, ...p }) => ({
        ...p,
        comments: comments
          .filter((c) => c.postId === p.id)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map(({ clubId: _c2, clientId: _k2, ...c }) => c),
      }));

  type Refusal = { status: number; code: string; error: string };
  const refuse = (status: number, code: string, error: string): Refusal => ({
    status,
    code,
    error,
  });

  function apply(intent: Json): Json | Refusal {
    const clubId = String(intent.clubId ?? '');
    const actor = String(intent.actor ?? '').toLowerCase();
    const target = String(intent.target ?? '').toLowerCase();
    const action = String(intent.action ?? '');
    const clientId = String(intent.clientId ?? '');
    let data: Json = {};
    try {
      data = intent.data ? JSON.parse(String(intent.data)) : {};
    } catch {
      return refuse(400, 'invalid', 'data must be a JSON object');
    }
    const owner = deps.owner(clubId)?.toLowerCase() ?? null;
    if (!owner) return refuse(404, 'not_found', 'No such club');
    const c = club(clubId);
    const isOwner = owner === actor;
    const isAdmin = isOwner || c.admins.has(actor);
    const member = !c.removed.has(actor) && deps.isMember(clubId, actor);
    const adminOnly = () =>
      isAdmin ? null : refuse(403, 'forbidden', 'Only club admins can do that');
    const memberOnly = () => (member ? null : refuse(403, 'forbidden', 'Join the club first'));

    switch (action) {
      case 'post': {
        const blocked = memberOnly();
        if (blocked) return blocked;
        const settings = { ...DEFAULT_SETTINGS, ...(c.settings ?? {}) };
        if ((settings.adminsOnlyPost || data.announcement) && !isAdmin) {
          return refuse(403, 'forbidden', 'Only club admins can post here');
        }
        const already = posts.find(
          (p) => p.clubId === clubId && p.author === actor && p.clientId === clientId
        );
        const post =
          already ??
          (() => {
            const created = {
              id: `sbx-club-post-${next++}`,
              clubId,
              author: actor,
              text: String(data.text ?? '').trim(),
              photos: Array.isArray(data.photos) ? (data.photos as string[]) : [],
              announcement: data.announcement === true,
              createdAt: deps.now(),
              clientId,
            };
            posts.push(created);
            return created;
          })();
        return { post: { ...feed(clubId, 50).find((p) => p.id === post.id) } };
      }
      case 'comment': {
        const blocked = memberOnly();
        if (blocked) return blocked;
        if (!posts.some((p) => p.id === intent.target))
          return refuse(404, 'not_found', 'That post is gone');
        const already = comments.find(
          (x) => x.clubId === clubId && x.author === actor && x.clientId === clientId
        );
        const comment = already ?? {
          id: `sbx-club-comment-${next++}`,
          postId: String(intent.target),
          clubId,
          author: actor,
          text: String(data.text ?? '').trim(),
          createdAt: deps.now(),
          clientId,
        };
        if (!already) comments.push(comment);
        const { clubId: _c, clientId: _k, ...out } = comment;
        return { comment: out };
      }
      case 'delete-post':
      case 'delete-comment': {
        const list = action === 'delete-post' ? posts : comments;
        const index = list.findIndex((x) => x.id === intent.target);
        const found = list[index];
        if (!found) return { deleted: true };
        if (found.author !== actor && !isAdmin) {
          return refuse(403, 'forbidden', 'You can only delete your own posts and comments');
        }
        list.splice(index, 1);
        if (action === 'delete-post') {
          for (let i = comments.length - 1; i >= 0; i--)
            if (comments[i]?.postId === found.id) comments.splice(i, 1);
        }
        return { deleted: true };
      }
      case 'settings': {
        const blocked = adminOnly();
        if (blocked) return blocked;
        c.settings = { ...DEFAULT_SETTINGS, ...data };
        return { settings: c.settings };
      }
      case 'set-role':
        if (!isOwner) return refuse(403, 'forbidden', 'Only the club owner can change admins');
        if (data.role === 'admin') c.admins.add(target);
        else c.admins.delete(target);
        return { role: data.role };
      case 'request': {
        if (c.removed.has(actor))
          return refuse(403, 'forbidden', 'You were removed from this club');
        const existing = c.requests.get(actor);
        if (existing && existing.status !== 'declined') return { status: existing.status };
        c.requests.set(actor, { status: 'pending', at: deps.now() });
        return { status: 'pending' };
      }
      case 'cancel-request':
        c.requests.delete(actor);
        return { status: null };
      case 'decide': {
        const blocked = adminOnly();
        if (blocked) return blocked;
        if (c.requests.get(target)?.status !== 'pending')
          return refuse(404, 'not_found', 'No request to decide');
        const status = data.approve === true ? 'approved' : 'declined';
        c.requests.set(target, { status, at: deps.now() });
        return { status };
      }
      case 'remove-member': {
        const blocked = adminOnly();
        if (blocked) return blocked;
        if (target === owner) return refuse(403, 'forbidden', 'The owner cannot be removed');
        if (c.admins.has(target) && !isOwner)
          return refuse(403, 'forbidden', 'Only the owner can remove an admin');
        const removed = data.removed !== false;
        if (removed) {
          c.removed.add(target);
          c.admins.delete(target);
        } else c.removed.delete(target);
        return { removed };
      }
      case 'link-event':
      case 'unlink-event': {
        const blocked = adminOnly();
        if (blocked) return blocked;
        if (action === 'link-event') c.events.add(String(intent.target));
        else c.events.delete(String(intent.target));
        return { linked: action === 'link-event' };
      }
      case 'notify':
        c.notify.set(actor, String(data.level));
        return { level: data.level };
      default:
        return refuse(400, 'invalid', 'unknown club action');
    }
  }

  /** Answers `/api/clubs/...`; null for a path that is not a club route. */
  function handle(route: string, method: string, query: URLSearchParams, body: Json | null) {
    if (method === 'POST' && route === 'action') {
      const result = apply((body?.intent as Json) ?? {});
      return 'code' in result &&
        'status' in result &&
        typeof result.status === 'number' &&
        'error' in result
        ? { status: result.status as number, body: { error: result.error, code: result.code } }
        : { status: 200, body: result };
    }
    if (method !== 'GET') return null;
    if (route === 'settings') {
      const settings: Json = {};
      for (const id of (query.get('ids') ?? '').split(',').filter(Boolean)) {
        const s = clubs.get(id)?.settings;
        if (s) settings[id] = { ...DEFAULT_SETTINGS, ...s };
      }
      return { status: 200, body: { settings } };
    }
    const [id, sub, member] = route.split('/');
    if (!id) return null;
    if (!deps.owner(id)) return { status: 404, body: { error: 'No such club', code: 'not_found' } };
    if (!sub) return { status: 200, body: { club: state(id) } };
    if (sub === 'feed')
      return { status: 200, body: { posts: feed(id, Number(query.get('limit') ?? 20)) } };
    if (sub === 'notify' && member) {
      return { status: 200, body: { level: club(id).notify.get(member.toLowerCase()) ?? 'all' } };
    }
    return null;
  }

  return { handle };
}

/** Seeded members of a seeded club, lowercased. */
export function seededClubMembers(clubId: string): string[] {
  return (SANDBOX_CLUB_MEMBERS[clubId] ?? []).map((m) => m.toLowerCase());
}
