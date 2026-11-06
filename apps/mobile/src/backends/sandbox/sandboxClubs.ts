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

type Refusal = { status: number; code: string; error: string };

const refuse = (status: number, code: string, error: string): Refusal => ({
  status,
  code,
  error,
});

const isRefusal = (result: Json | Refusal): result is Refusal =>
  'code' in result && 'status' in result && typeof result.status === 'number' && 'error' in result;

const settingsOf = (data: ClubData) => ({ ...DEFAULT_SETTINGS, ...(data.settings ?? {}) });

function buildFeed(posts: Post[], comments: Comment[], id: string, limit: number) {
  return posts
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
}

/** Everything one club action needs: who acts on what, their rights, and the club's stores. */
interface ActionContext {
  intent: Json;
  action: string;
  clubId: string;
  actor: string;
  target: string;
  clientId: string;
  data: Json;
  owner: string;
  club: ClubData;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  now: () => number;
  posts: Post[];
  comments: Comment[];
  nextId: () => number;
}

type ActionHandler = (ctx: ActionContext) => Json | Refusal;

const requireAdmin = (ctx: ActionContext): Refusal | null =>
  ctx.isAdmin ? null : refuse(403, 'forbidden', 'Only club admins can do that');

const requireMember = (ctx: ActionContext): Refusal | null =>
  ctx.isMember ? null : refuse(403, 'forbidden', 'Join the club first');

function createPost(ctx: ActionContext): Post {
  const { data } = ctx;
  const created = {
    id: `sbx-club-post-${ctx.nextId()}`,
    clubId: ctx.clubId,
    author: ctx.actor,
    text: String(data.text ?? '').trim(),
    photos: Array.isArray(data.photos) ? (data.photos as string[]) : [],
    announcement: data.announcement === true,
    createdAt: ctx.now(),
    clientId: ctx.clientId,
  };
  ctx.posts.push(created);
  return created;
}

const actPost: ActionHandler = (ctx) => {
  const blocked = requireMember(ctx);
  if (blocked) return blocked;
  if ((settingsOf(ctx.club).adminsOnlyPost || ctx.data.announcement) && !ctx.isAdmin) {
    return refuse(403, 'forbidden', 'Only club admins can post here');
  }
  const already = ctx.posts.find(
    (p) => p.clubId === ctx.clubId && p.author === ctx.actor && p.clientId === ctx.clientId
  );
  const post = already ?? createPost(ctx);
  const published = buildFeed(ctx.posts, ctx.comments, ctx.clubId, 50).find(
    (p) => p.id === post.id
  );
  return { post: { ...published } };
};

const actComment: ActionHandler = (ctx) => {
  const blocked = requireMember(ctx);
  if (blocked) return blocked;
  if (!ctx.posts.some((p) => p.id === ctx.intent.target))
    return refuse(404, 'not_found', 'That post is gone');
  const already = ctx.comments.find(
    (x) => x.clubId === ctx.clubId && x.author === ctx.actor && x.clientId === ctx.clientId
  );
  const comment = already ?? {
    id: `sbx-club-comment-${ctx.nextId()}`,
    postId: String(ctx.intent.target),
    clubId: ctx.clubId,
    author: ctx.actor,
    text: String(ctx.data.text ?? '').trim(),
    createdAt: ctx.now(),
    clientId: ctx.clientId,
  };
  if (!already) ctx.comments.push(comment);
  const { clubId: _c, clientId: _k, ...out } = comment;
  return { comment: out };
};

function dropCommentsOf(comments: Comment[], postId: string): void {
  for (let i = comments.length - 1; i >= 0; i--) {
    if (comments[i]?.postId === postId) comments.splice(i, 1);
  }
}

const actDelete: ActionHandler = (ctx) => {
  const isPost = ctx.action === 'delete-post';
  const list = isPost ? ctx.posts : ctx.comments;
  const index = list.findIndex((x) => x.id === ctx.intent.target);
  const found = list[index];
  if (!found) return { deleted: true };
  if (found.author !== ctx.actor && !ctx.isAdmin) {
    return refuse(403, 'forbidden', 'You can only delete your own posts and comments');
  }
  list.splice(index, 1);
  if (isPost) dropCommentsOf(ctx.comments, found.id);
  return { deleted: true };
};

const actSettings: ActionHandler = (ctx) => {
  const blocked = requireAdmin(ctx);
  if (blocked) return blocked;
  ctx.club.settings = { ...DEFAULT_SETTINGS, ...ctx.data };
  return { settings: ctx.club.settings };
};

const actSetRole: ActionHandler = (ctx) => {
  if (!ctx.isOwner) return refuse(403, 'forbidden', 'Only the club owner can change admins');
  if (ctx.data.role === 'admin') ctx.club.admins.add(ctx.target);
  else ctx.club.admins.delete(ctx.target);
  return { role: ctx.data.role };
};

const actRequest: ActionHandler = (ctx) => {
  const { club, actor } = ctx;
  if (club.removed.has(actor)) return refuse(403, 'forbidden', 'You were removed from this club');
  const existing = club.requests.get(actor);
  if (existing && existing.status !== 'declined') return { status: existing.status };
  club.requests.set(actor, { status: 'pending', at: ctx.now() });
  return { status: 'pending' };
};

const actCancelRequest: ActionHandler = (ctx) => {
  ctx.club.requests.delete(ctx.actor);
  return { status: null };
};

const actDecide: ActionHandler = (ctx) => {
  const blocked = requireAdmin(ctx);
  if (blocked) return blocked;
  if (ctx.club.requests.get(ctx.target)?.status !== 'pending')
    return refuse(404, 'not_found', 'No request to decide');
  const status = ctx.data.approve === true ? 'approved' : 'declined';
  ctx.club.requests.set(ctx.target, { status, at: ctx.now() });
  return { status };
};

const actRemoveMember: ActionHandler = (ctx) => {
  const blocked = requireAdmin(ctx);
  if (blocked) return blocked;
  const { club, target } = ctx;
  if (target === ctx.owner) return refuse(403, 'forbidden', 'The owner cannot be removed');
  if (club.admins.has(target) && !ctx.isOwner)
    return refuse(403, 'forbidden', 'Only the owner can remove an admin');
  const removed = ctx.data.removed !== false;
  if (removed) {
    club.removed.add(target);
    club.admins.delete(target);
  } else {
    club.removed.delete(target);
  }
  return { removed };
};

const actLinkEvent: ActionHandler = (ctx) => {
  const blocked = requireAdmin(ctx);
  if (blocked) return blocked;
  const linking = ctx.action === 'link-event';
  if (linking) ctx.club.events.add(String(ctx.intent.target));
  else ctx.club.events.delete(String(ctx.intent.target));
  return { linked: linking };
};

const actNotify: ActionHandler = (ctx) => {
  ctx.club.notify.set(ctx.actor, String(ctx.data.level));
  return { level: ctx.data.level };
};

const ACTIONS: Record<string, ActionHandler> = {
  post: actPost,
  comment: actComment,
  'delete-post': actDelete,
  'delete-comment': actDelete,
  settings: actSettings,
  'set-role': actSetRole,
  request: actRequest,
  'cancel-request': actCancelRequest,
  decide: actDecide,
  'remove-member': actRemoveMember,
  'link-event': actLinkEvent,
  'unlink-event': actLinkEvent,
  notify: actNotify,
};

function parseIntentData(intent: Json): { data: Json } | null {
  try {
    return { data: intent.data ? JSON.parse(String(intent.data)) : {} };
  } catch {
    return null;
  }
}

function actionResponse(result: Json | Refusal) {
  return isRefusal(result)
    ? { status: result.status, body: { error: result.error, code: result.code } }
    : { status: 200, body: result };
}

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

  const feed = (id: string, limit: number) => buildFeed(posts, comments, id, limit);

  function apply(intent: Json): Json | Refusal {
    const clubId = String(intent.clubId ?? '');
    const actor = String(intent.actor ?? '').toLowerCase();
    const parsed = parseIntentData(intent);
    if (!parsed) return refuse(400, 'invalid', 'data must be a JSON object');
    const owner = deps.owner(clubId)?.toLowerCase() ?? null;
    if (!owner) return refuse(404, 'not_found', 'No such club');
    const c = club(clubId);
    const isOwner = owner === actor;
    const action = String(intent.action ?? '');
    const handler = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : undefined;
    if (!handler) return refuse(400, 'invalid', 'unknown club action');
    return handler({
      intent,
      action,
      clubId,
      actor,
      target: String(intent.target ?? '').toLowerCase(),
      clientId: String(intent.clientId ?? ''),
      data: parsed.data,
      owner,
      club: c,
      isOwner,
      isAdmin: isOwner || c.admins.has(actor),
      isMember: !c.removed.has(actor) && deps.isMember(clubId, actor),
      now: deps.now,
      posts,
      comments,
      nextId: () => next++,
    });
  }

  /** Answers `GET /api/clubs/...`; null for a path that is not a club read. */
  function read(route: string, query: URLSearchParams) {
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

  /** Answers `/api/clubs/...`; null for a path that is not a club route. */
  function handle(route: string, method: string, query: URLSearchParams, body: Json | null) {
    if (method === 'POST' && route === 'action') {
      return actionResponse(apply((body?.intent as Json) ?? {}));
    }
    return method === 'GET' ? read(route, query) : null;
  }

  return { handle };
}

/** Seeded members of a seeded club, lowercased. */
export function seededClubMembers(clubId: string): string[] {
  return (SANDBOX_CLUB_MEMBERS[clubId] ?? []).map((m) => m.toLowerCase());
}
