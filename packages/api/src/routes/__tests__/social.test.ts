import { describe, expect, it, vi } from 'vitest';
import { CommentLikeError } from '../../lib/commentLikes.js';
import { FollowError } from '../../lib/follows.js';
import { PostError } from '../../lib/posts.js';
import { AboutError } from '../../lib/profileAbout.js';
import { ReportError } from '../../lib/reports.js';
import { createSocialRoutes } from '../social.js';

const ME = '0x00000000000000000000000000000000000000aa';

function appWith(service: Record<string, unknown>) {
  return createSocialRoutes(() => service as never);
}

const post = (app: ReturnType<typeof appWith>, path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /follow', () => {
  it('answers with the result of the follow', async () => {
    const apply = vi.fn().mockResolvedValue({ following: true, created: true });
    const body = { intent: { follower: ME }, signature: '0xabc' };

    const res = await post(appWith({ apply }), '/follow', body);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ following: true, created: true });
    expect(apply).toHaveBeenCalledWith(body);
  });

  it.each([
    ['invalid', 400],
    ['expired', 400],
    ['self_follow', 400],
    ['bad_signature', 401],
  ] as const)('maps a %s refusal to HTTP %i with its code', async (code, status) => {
    const apply = vi.fn().mockRejectedValue(new FollowError(code, 'nope'));

    const res = await post(appWith({ apply }), '/follow', {});

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: 'nope', code });
  });

  it('answers 400 for a body that is not JSON', async () => {
    const res = await appWith({ apply: vi.fn() }).request('/follow', {
      method: 'POST',
      body: 'not json',
    });

    expect(res.status).toBe(400);
  });

  it('lets unexpected failures reach the global error handler', async () => {
    const apply = vi.fn().mockRejectedValue(new Error('arkiv down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await post(appWith({ apply }), '/follow', { intent: {}, signature: 'x' });

    expect(res.status).toBe(500);
  });
});

describe('reading follows', () => {
  it('lists who an address follows', async () => {
    const following = vi.fn().mockResolvedValue({ addresses: [ME], truncated: false });

    const res = await appWith({ following }).request(`/following/${ME}`);

    expect(await res.json()).toEqual({ addresses: [ME], truncated: false });
    expect(following).toHaveBeenCalledWith(ME);
  });

  it('lists an address’s followers', async () => {
    const followers = vi.fn().mockResolvedValue({ addresses: [], truncated: false });

    const res = await appWith({ followers }).request(`/followers/${ME}`);

    expect(res.status).toBe(200);
  });

  it('answers 400 for an address that is not one', async () => {
    const following = vi.fn().mockRejectedValue(new FollowError('invalid', 'bad address'));

    const res = await appWith({ following }).request('/following/nope');

    expect(res.status).toBe(400);
  });
});

describe('comment likes', () => {
  const COMMENT = `0x${'11'.repeat(32)}`;
  const likesApp = (service: Record<string, unknown>) =>
    createSocialRoutes(
      () => ({}) as never,
      () => service as never
    );

  it('POST /comment-like answers with the result', async () => {
    const apply = vi.fn().mockResolvedValue({ liked: true, created: true });
    const body = { intent: { liker: ME }, signature: '0xabc' };

    const res = await post(likesApp({ apply }) as never, '/comment-like', body);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ liked: true, created: true });
    expect(apply).toHaveBeenCalledWith(body);
  });

  it.each([
    ['invalid', 400],
    ['expired', 400],
    ['bad_signature', 401],
  ] as const)('maps a %s refusal to HTTP %i with its code', async (code, status) => {
    const apply = vi.fn().mockRejectedValue(new CommentLikeError(code, 'nope'));

    const res = await post(likesApp({ apply }) as never, '/comment-like', {});

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: 'nope', code });
  });

  it('POST /comment-like answers 400 for a body that is not JSON', async () => {
    const res = await likesApp({ apply: vi.fn() }).request('/comment-like', {
      method: 'POST',
      body: 'not json',
    });

    expect(res.status).toBe(400);
  });

  it('GET /comment-likes reads the comma-separated ids', async () => {
    const likesFor = vi.fn().mockResolvedValue({ likes: { [COMMENT]: [ME] }, truncated: false });

    const res = await likesApp({ likesFor }).request(`/comment-likes?ids=${COMMENT},${COMMENT}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ likes: { [COMMENT]: [ME] }, truncated: false });
    expect(likesFor).toHaveBeenCalledWith([COMMENT, COMMENT]);
  });

  it('GET /comment-likes with no ids asks about none', async () => {
    const likesFor = vi.fn().mockResolvedValue({ likes: {}, truncated: false });

    await likesApp({ likesFor }).request('/comment-likes');

    expect(likesFor).toHaveBeenCalledWith([]);
  });

  it('GET /comment-likes maps a refusal like the others', async () => {
    const likesFor = vi.fn().mockRejectedValue(new CommentLikeError('invalid', 'bad id'));

    const res = await likesApp({ likesFor }).request('/comment-likes?ids=nope');

    expect(res.status).toBe(400);
  });
});

describe('profile about', () => {
  const aboutApp = (service: Record<string, unknown>) =>
    createSocialRoutes(
      () => ({}) as never,
      () => ({}) as never,
      () => service as never
    );

  it('POST /about answers with what was saved', async () => {
    const apply = vi.fn().mockResolvedValue({ about: { bio: 'hi', location: 'Pune' } });
    const body = { intent: { author: ME }, signature: '0xabc' };

    const res = await post(aboutApp({ apply }) as never, '/about', body);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ about: { bio: 'hi', location: 'Pune' } });
    expect(apply).toHaveBeenCalledWith(body);
  });

  it.each([
    ['invalid', 400],
    ['expired', 400],
    ['bad_signature', 401],
  ] as const)('maps a %s refusal to HTTP %i with its code', async (code, status) => {
    const apply = vi.fn().mockRejectedValue(new AboutError(code, 'nope'));

    const res = await post(aboutApp({ apply }) as never, '/about', {});

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: 'nope', code });
  });

  it('POST /about answers 400 for a body that is not JSON and 413 for an oversized one', async () => {
    const app = aboutApp({ apply: vi.fn() });

    expect((await app.request('/about', { method: 'POST', body: 'not json' })).status).toBe(400);
    const big = await post(app as never, '/about', { intent: 'x'.repeat(9 * 1024) });
    expect(big.status).toBe(413);
  });

  it('GET /about reads the comma-separated authors', async () => {
    const forAuthors = vi.fn().mockResolvedValue({ about: { [ME]: { bio: 'hi', location: '' } } });

    const res = await aboutApp({ forAuthors }).request(`/about?authors=${ME},${ME}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ about: { [ME]: { bio: 'hi', location: '' } } });
    expect(forAuthors).toHaveBeenCalledWith([ME, ME]);
  });

  it('GET /about with no authors asks about none', async () => {
    const forAuthors = vi.fn().mockResolvedValue({ about: {} });

    await aboutApp({ forAuthors }).request('/about');

    expect(forAuthors).toHaveBeenCalledWith([]);
  });

  it('GET /about maps a refusal like the others', async () => {
    const forAuthors = vi.fn().mockRejectedValue(new AboutError('invalid', 'bad address'));

    const res = await aboutApp({ forAuthors }).request('/about?authors=nope');

    expect(res.status).toBe(400);
  });
});

describe('posts', () => {
  const postsApp = (service: Record<string, unknown>) =>
    createSocialRoutes(
      () => ({}) as never,
      () => ({}) as never,
      () => ({}) as never,
      () => service as never
    );

  it('POST /post answers with the result', async () => {
    const apply = vi.fn().mockResolvedValue({ post: { id: 'p1' } });
    const body = { intent: { author: ME }, signature: '0xabc' };

    const res = await post(postsApp({ apply }) as never, '/post', body);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ post: { id: 'p1' } });
    expect(apply).toHaveBeenCalledWith(body);
  });

  it.each([
    ['invalid', 400],
    ['expired', 400],
    ['bad_signature', 401],
    ['forbidden', 403],
    ['rate_limited', 429],
  ] as const)('maps a %s refusal to HTTP %i with its code', async (code, status) => {
    const apply = vi.fn().mockRejectedValue(new PostError(code, 'nope'));

    const res = await post(postsApp({ apply }) as never, '/post', {});

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: 'nope', code });
  });

  it('POST /post answers 400 for a body that is not JSON and 413 for an oversized one', async () => {
    const app = postsApp({ apply: vi.fn() });

    expect((await app.request('/post', { method: 'POST', body: 'not json' })).status).toBe(400);
    expect((await post(app as never, '/post', { intent: 'x'.repeat(9 * 1024) })).status).toBe(413);
  });

  it('GET /posts reads the authors and the limit', async () => {
    const forAuthors = vi.fn().mockResolvedValue({ posts: [] });

    const res = await postsApp({ forAuthors }).request(`/posts?authors=${ME},${ME}&limit=5`);

    expect(res.status).toBe(200);
    expect(forAuthors).toHaveBeenCalledWith([ME, ME], 5);
  });

  it('GET /posts defaults to 20 posts and asks about no one without authors', async () => {
    const forAuthors = vi.fn().mockResolvedValue({ posts: [] });

    await postsApp({ forAuthors }).request('/posts');

    expect(forAuthors).toHaveBeenCalledWith([], 20);
  });

  it('GET /posts refuses a limit that is not a number', async () => {
    const forAuthors = vi.fn().mockRejectedValue(new PostError('invalid', 'bad limit'));

    const res = await postsApp({ forAuthors }).request(`/posts?authors=${ME}&limit=abc`);

    expect(res.status).toBe(400);
    expect(forAuthors).toHaveBeenCalledWith([ME], Number.NaN);
  });
});

describe('POST /report', () => {
  const reportApp = (service: Record<string, unknown>) =>
    createSocialRoutes(
      () => ({}) as never,
      () => ({}) as never,
      () => ({}) as never,
      () => ({}) as never,
      () => service as never
    );

  it('answers with the result of the report', async () => {
    const apply = vi.fn().mockResolvedValue({ reported: true, created: true });
    const body = { intent: { reporter: ME }, signature: '0xabc' };

    const res = await post(reportApp({ apply }), '/report', body);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reported: true, created: true });
    expect(apply).toHaveBeenCalledWith(body);
  });

  it.each([
    ['invalid', 400],
    ['expired', 400],
    ['self_report', 400],
    ['bad_signature', 401],
  ] as const)('maps a %s refusal to HTTP %i with its code', async (code, status) => {
    const apply = vi.fn().mockRejectedValue(new ReportError(code, 'nope'));

    const res = await post(reportApp({ apply }), '/report', {});

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: 'nope', code });
  });

  it('answers 400 for a body that is not JSON', async () => {
    const res = await reportApp({ apply: vi.fn() }).request('/report', {
      method: 'POST',
      body: 'not json',
    });

    expect(res.status).toBe(400);
  });

  it('lets unexpected failures reach the global error handler', async () => {
    const apply = vi.fn().mockRejectedValue(new Error('arkiv down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await post(reportApp({ apply }), '/report', { intent: {}, signature: 'x' });

    expect(res.status).toBe(500);
  });
});
