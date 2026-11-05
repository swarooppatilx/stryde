import { beforeEach, describe, expect, it } from 'vitest';
import { createSandboxApi } from '@/backends/sandbox/sandboxApi';

const BASE = 'http://api.test/api/social';
const ME = '0x00000000000000000000000000000000000000aa';
const A = '0x00000000000000000000000000000000000000bb';
const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

let api: ReturnType<typeof createSandboxApi>;
let clock: number;

beforeEach(() => {
  clock = 1_700_000_000;
  api = createSandboxApi(() => clock);
});

const post = (path: string, body: unknown) =>
  api.fetch(`${BASE}/${path}`, { method: 'POST', body: JSON.stringify(body) });
const get = (path: string) => api.fetch(`${BASE}/${path}`);
const json = async (res: Response) => res.json();

describe('follows', () => {
  const intent = (action: 'follow' | 'unfollow', follower = ME, followee = A) => ({
    intent: { follower, followee, action, deadline: clock + 60 },
    signature: '0xsigned',
  });

  it('follows, reports it as created once, and lists both directions', async () => {
    expect(await json(await post('follow', intent('follow')))).toEqual({
      following: true,
      created: true,
    });
    expect(await json(await post('follow', intent('follow')))).toEqual({
      following: true,
      created: false,
    });

    const following = await json(await get(`following/${ME}`));
    expect(following.addresses).toEqual([A]);
    expect(following.entries).toEqual([{ address: A, followedAt: clock }]);
    expect((await json(await get(`followers/${A}`))).addresses).toEqual([ME]);
  });

  it('unfollows', async () => {
    await post('follow', intent('follow'));

    expect(await json(await post('follow', intent('unfollow')))).toEqual({
      following: false,
      created: false,
    });
    expect((await json(await get(`following/${ME}`))).addresses).toEqual([]);
  });

  it('refuses to follow yourself like the real API', async () => {
    const res = await post('follow', intent('follow', ME, ME));

    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ code: 'self_follow' });
  });

  it('matches wallets whatever their letter case', async () => {
    await post('follow', intent('follow', ME.toUpperCase().replace('0X', '0x'), A));

    expect((await json(await get(`following/${ME}`))).addresses).toEqual([A]);
  });
});

describe('bio and location', () => {
  const about = (bio: string, location: string, author = ME) => ({
    intent: { author, bio, location, deadline: clock + 60 },
    signature: '0xsigned',
  });

  it('saves, reads back and replaces', async () => {
    await post('about', about('Trail runner', 'Pune'));
    await post('about', about('New bio', 'Goa'));

    expect(await json(await get(`about?authors=${ME},${A}`))).toEqual({
      about: { [ME]: { bio: 'New bio', location: 'Goa' } },
    });
  });

  it('clears when both are empty', async () => {
    await post('about', about('hi', ''));
    await post('about', about('', ''));

    expect(await json(await get(`about?authors=${ME}`))).toEqual({ about: {} });
  });
});

describe('posts', () => {
  const create = (text: string, clientId: string, author = ME, photos: string[] = []) => ({
    intent: {
      author,
      action: 'create',
      text,
      photos,
      postId: '',
      clientId,
      deadline: clock + 60,
    },
    signature: '0xsigned',
  });

  it('publishes a post and lists the newest first', async () => {
    await post('post', create('first', 'c1'));
    clock += 10;
    await post('post', create('second', 'c2', A));

    const { posts } = await json(await get(`posts?authors=${ME},${A}&limit=10`));

    expect(posts.map((p: { text: string }) => p.text)).toEqual(['second', 'first']);
    expect(posts[1]).toMatchObject({ author: ME, photos: [], createdAt: 1_700_000_000 });
  });

  it('returns the stored post for a repeated client id instead of publishing twice', async () => {
    const first = await json(await post('post', create('hello', 'same')));
    const second = await json(await post('post', create('hello', 'same')));

    expect(second.post.id).toBe(first.post.id);
    expect((await json(await get(`posts?authors=${ME}&limit=10`))).posts).toHaveLength(1);
  });

  it('honours the limit', async () => {
    for (let i = 0; i < 3; i++) {
      clock += 1;
      await post('post', create(`p${i}`, `c${i}`, ME, [CID]));
    }

    expect((await json(await get(`posts?authors=${ME}&limit=2`))).posts).toHaveLength(2);
  });

  it('deletes only your own post, and treats a missing one as deleted', async () => {
    const { post: stored } = await json(await post('post', create('mine', 'c1')));
    const del = (author: string, postId: string) => ({
      intent: {
        author,
        action: 'delete',
        text: '',
        photos: [],
        postId,
        clientId: '',
        deadline: clock + 60,
      },
      signature: '0xsigned',
    });

    const forbidden = await post('post', del(A, stored.id));
    expect(forbidden.status).toBe(403);

    expect(await json(await post('post', del(ME, stored.id)))).toEqual({ deleted: true });
    expect(await json(await post('post', del(ME, 'gone')))).toEqual({ deleted: true });
    expect((await json(await get(`posts?authors=${ME}&limit=10`))).posts).toEqual([]);
  });
});

describe('comment likes', () => {
  const COMMENT = `0x${'11'.repeat(32)}`;
  const like = (action: 'like' | 'unlike', liker = ME) => ({
    intent: { liker, commentId: COMMENT, action, deadline: clock + 60 },
    signature: '0xsigned',
  });

  it('likes, lists who liked, and unlikes', async () => {
    expect(await json(await post('comment-like', like('like')))).toEqual({
      liked: true,
      created: true,
    });
    expect(await json(await post('comment-like', like('like')))).toEqual({
      liked: true,
      created: false,
    });
    await post('comment-like', like('like', A));

    expect(await json(await get(`comment-likes?ids=${COMMENT}`))).toEqual({
      likes: { [COMMENT]: [ME, A] },
      truncated: false,
    });

    expect(await json(await post('comment-like', like('unlike')))).toEqual({
      liked: false,
      created: false,
    });
    expect((await json(await get(`comment-likes?ids=${COMMENT}`))).likes[COMMENT]).toEqual([A]);
  });

  it('answers every comment asked about, with an empty list for an unliked one', async () => {
    expect(await json(await get(`comment-likes?ids=${COMMENT}`))).toEqual({
      likes: { [COMMENT]: [] },
      truncated: false,
    });
  });
});

describe('everything else', () => {
  it('answers 404 for a route it does not fake, in the API’s error shape', async () => {
    const res = await get('nothing-here');

    expect(res.status).toBe(404);
    expect(await json(res)).toHaveProperty('error');
  });

  it('answers 400 for a body that is not JSON', async () => {
    const res = await api.fetch(`${BASE}/follow`, { method: 'POST', body: 'nope' });

    expect(res.status).toBe(400);
  });
});

describe('relay and IPFS', () => {
  it('confirms every relayed write with a distinct hash', async () => {
    const first = await json(
      await api.fetch('http://api.test/api/relay/mint-reward', { method: 'POST', body: '{}' })
    );
    const second = await json(
      await api.fetch('http://api.test/api/relay/mint-achievement', { method: 'POST', body: '{}' })
    );
    expect(first.confirmed).toBe(true);
    expect(first.hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(second.hash).not.toBe(first.hash);
  });

  it('pins an upload and answers with a cid', async () => {
    const res = await api.fetch('http://api.test/api/ipfs/upload', {
      method: 'POST',
      body: JSON.stringify({ name: 'a', content: { x: 1 } }),
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.cid).toMatch(/^bafy/);
    expect(body.size).toBeGreaterThan(0);
  });

  it('gives different uploads different cids', async () => {
    const upload = async (content: object) =>
      (
        await json(
          await api.fetch('http://api.test/api/ipfs/upload', {
            method: 'POST',
            body: JSON.stringify({ name: 'a', content }),
          })
        )
      ).cid;
    expect(await upload({ x: 1 })).not.toBe(await upload({ x: 2 }));
  });
});
