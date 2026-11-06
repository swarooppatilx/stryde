/**
 * The social API answered on the device, for the Sandbox profile (no network). It speaks the same
 * routes and answer shapes as `packages/api` for follows, bio/location and posts, so the app code
 * under test cannot tell the difference, but it keeps everything in memory and does not check
 * signatures. Dev builds only.
 */
import { createSandboxClubs, type SandboxClubDeps } from './sandboxClubs';

interface StoredPost {
  id: string;
  author: string;
  text: string;
  photos: string[];
  createdAt: number;
  clientId: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const refuse = (status: number, code: string, error: string) => json(status, { error, code });

const INVALID_JSON = () => json(400, { error: 'Invalid JSON body' });

function parseJsonBody(init?: RequestInit): { body: Record<string, unknown> } | null {
  try {
    return { body: JSON.parse(String(init?.body ?? '')) };
  } catch {
    return null;
  }
}

const lower = (value: unknown) => String(value ?? '').toLowerCase();

export function createSandboxApi(
  now: () => number = () => Math.floor(Date.now() / 1000),
  clubDeps?: Omit<SandboxClubDeps, 'now'>
) {
  const clubs = createSandboxClubs({
    now,
    owner: clubDeps?.owner ?? (() => null),
    isMember: clubDeps?.isMember ?? (() => true),
  });
  const follows = new Map<string, number>(); // `${follower}>${followee}` -> followedAt
  const about = new Map<string, { bio: string; location: string }>();
  const commentLikes = new Map<string, string[]>(); // commentId -> likers, in the order they liked
  const posts: StoredPost[] = [];
  let nextPost = 1;

  const followList = (address: string, side: 'follower' | 'followee') => {
    const entries = [...follows.entries()]
      .map(([key, followedAt]) => {
        const [follower, followee] = key.split('>') as [string, string];
        return { follower, followee, followedAt };
      })
      .filter((f) => f[side] === address)
      .map((f) => ({
        address: side === 'follower' ? f.followee : f.follower,
        followedAt: f.followedAt,
      }));
    return { addresses: entries.map((e) => e.address), entries, truncated: false };
  };

  const applyFollow = (body: { intent?: Record<string, unknown> }) => {
    const intent = body.intent ?? {};
    const follower = lower(intent.follower);
    const followee = lower(intent.followee);
    if (follower === followee) return refuse(400, 'self_follow', 'You cannot follow yourself');
    const key = `${follower}>${followee}`;
    if (intent.action === 'unfollow') {
      follows.delete(key);
      return json(200, { following: false, created: false });
    }
    if (follows.has(key)) return json(200, { following: true, created: false });
    follows.set(key, now());
    return json(200, { following: true, created: true });
  };

  const applyAbout = (body: { intent?: Record<string, unknown> }) => {
    const intent = body.intent ?? {};
    const author = lower(intent.author);
    const bio = String(intent.bio ?? '').trim();
    const location = String(intent.location ?? '').trim();
    if (!bio && !location) about.delete(author);
    else about.set(author, { bio, location });
    return json(200, { about: { bio, location } });
  };

  const applyCommentLike = (body: { intent?: Record<string, unknown> }) => {
    const intent = body.intent ?? {};
    const commentId = lower(intent.commentId);
    const liker = lower(intent.liker);
    const likers = commentLikes.get(commentId) ?? [];
    if (intent.action === 'unlike') {
      commentLikes.set(
        commentId,
        likers.filter((l) => l !== liker)
      );
      return json(200, { liked: false, created: false });
    }
    if (likers.includes(liker)) return json(200, { liked: true, created: false });
    commentLikes.set(commentId, [...likers, liker]);
    return json(200, { liked: true, created: true });
  };

  const readCommentLikes = (query: URLSearchParams) => {
    const likes: Record<string, string[]> = {};
    for (const id of (query.get('ids') ?? '').split(',').filter(Boolean)) {
      likes[id.toLowerCase()] = commentLikes.get(id.toLowerCase()) ?? [];
    }
    return json(200, { likes, truncated: false });
  };

  const applyPost = (body: { intent?: Record<string, unknown> }) => {
    const intent = body.intent ?? {};
    const author = lower(intent.author);
    if (intent.action === 'delete') {
      const index = posts.findIndex((p) => p.id === intent.postId);
      const existing = posts[index];
      if (existing && existing.author !== author) {
        return refuse(403, 'forbidden', 'You can only delete your own posts');
      }
      if (existing) posts.splice(index, 1);
      return json(200, { deleted: true });
    }
    const clientId = String(intent.clientId ?? '');
    const already = posts.find((p) => p.author === author && p.clientId === clientId);
    if (already) return json(200, { post: already });
    const created: StoredPost = {
      id: `sandbox-post-${nextPost++}`,
      author,
      text: String(intent.text ?? '').trim(),
      photos: Array.isArray(intent.photos) ? (intent.photos as string[]) : [],
      createdAt: now(),
      clientId,
    };
    posts.push(created);
    return json(200, { post: created });
  };

  const readPosts = (query: URLSearchParams) => {
    const authors = new Set(
      (query.get('authors') ?? '')
        .split(',')
        .filter(Boolean)
        .map((a) => a.toLowerCase())
    );
    const limit = Number(query.get('limit') ?? 20);
    return json(200, {
      posts: posts
        .filter((p) => authors.has(p.author))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit),
    });
  };

  const readAbout = (query: URLSearchParams) => {
    const found: Record<string, { bio: string; location: string }> = {};
    for (const author of (query.get('authors') ?? '').split(',').filter(Boolean)) {
      const text = about.get(author.toLowerCase());
      if (text) found[author.toLowerCase()] = text;
    }
    return json(200, { about: found });
  };

  /** Relayed writes (mints, season credit) always succeed; each gets its own transaction hash. */
  let relayed = 0;
  const confirmRelay = () => {
    relayed += 1;
    return json(200, { confirmed: true, hash: `0x${relayed.toString(16).padStart(64, '0')}` });
  };

  /** A pin always works; the cid is derived from the content so equal uploads share one. */
  const pin = (init?: RequestInit) => {
    const body = String(init?.body ?? '');
    let hash = 5381;
    for (let i = 0; i < body.length; i++) hash = (hash * 33) ^ body.charCodeAt(i);
    return json(200, { cid: `bafysandbox${(hash >>> 0).toString(36)}`, size: body.length });
  };

  const serveClubs = (url: URL, method: string, init?: RequestInit): Response | null => {
    let body: Record<string, unknown> | null = null;
    if (method === 'POST') {
      const parsed = parseJsonBody(init);
      if (!parsed) return INVALID_JSON();
      body = parsed.body;
    }
    const answer = clubs.handle(
      url.pathname.replace(/^.*\/api\/clubs\//, ''),
      method,
      url.searchParams,
      body
    );
    return answer ? json(answer.status, answer.body) : null;
  };

  const SOCIAL_WRITES: Record<string, (body: { intent?: Record<string, unknown> }) => Response> = {
    follow: applyFollow,
    about: applyAbout,
    post: applyPost,
    'comment-like': applyCommentLike,
    report: () => json(200, { reported: true, created: true }),
  };

  const writeSocial = (route: string, init?: RequestInit): Response | null => {
    const parsed = parseJsonBody(init);
    if (!parsed) return INVALID_JSON();
    const write = Object.hasOwn(SOCIAL_WRITES, route) ? SOCIAL_WRITES[route] : undefined;
    return write?.(parsed.body as { intent?: Record<string, unknown> }) ?? null;
  };

  const readSocial = (route: string, query: URLSearchParams): Response | null => {
    if (route.startsWith('following/'))
      return json(200, followList(lower(route.slice(10)), 'follower'));
    if (route.startsWith('followers/'))
      return json(200, followList(lower(route.slice(10)), 'followee'));
    if (route === 'about') return readAbout(query);
    if (route === 'posts') return readPosts(query);
    if (route === 'comment-likes') return readCommentLikes(query);
    return null;
  };

  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'POST' && url.pathname.includes('/api/relay/')) return confirmRelay();
    if (method === 'POST' && url.pathname.endsWith('/api/ipfs/upload')) return pin(init);
    const clubAnswer = url.pathname.includes('/api/clubs/') ? serveClubs(url, method, init) : null;
    if (clubAnswer) return clubAnswer;
    const route = url.pathname.replace(/^.*\/api\/social\//, '');
    const answer =
      method === 'POST' ? writeSocial(route, init) : readSocial(route, url.searchParams);
    return answer ?? json(404, { error: `Not faked in the sandbox: ${method} ${route}` });
  };

  return { fetch: fakeFetch as typeof fetch };
}
