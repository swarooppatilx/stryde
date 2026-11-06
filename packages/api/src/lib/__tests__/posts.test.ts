import { describe, expect, it, vi } from 'vitest';
import {
  createPostService,
  MAX_PHOTOS,
  MAX_POST_LENGTH,
  MAX_POSTS_PER_DAY,
  PostError,
  type PostRecord,
  type PostStore,
} from '../posts.js';

const ME = '0x00000000000000000000000000000000000000aa' as const;
const THEM = '0x00000000000000000000000000000000000000bb' as const;
const NOW = 1_000_000;
const SIGNATURE = '0xsigned' as const;
const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

function memoryStore(): PostStore & { records: PostRecord[] } {
  const records: PostRecord[] = [];
  return {
    records,
    async create(input) {
      const record = { id: `post-${records.length + 1}`, ...input };
      records.push(record);
      return record;
    },
    async find(id) {
      return records.find((r) => r.id === id) ?? null;
    },
    async remove(id) {
      const index = records.findIndex((r) => r.id === id);
      if (index >= 0) records.splice(index, 1);
    },
    async removeAllFor(author) {
      const gone = records.filter((r) => r.author === author);
      for (const record of gone) records.splice(records.indexOf(record), 1);
      return gone.length;
    },
    async recent(authors, limit) {
      return records
        .filter((r) => authors.includes(r.author))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    },
    async findByClientId(author, clientId) {
      return records.find((r) => r.author === author && r.clientId === clientId) ?? null;
    },
    async countSince(author, since) {
      return records.filter((r) => r.author === author && r.createdAt >= since).length;
    },
  };
}

const create = (over: Record<string, unknown> = {}) => ({
  author: ME,
  action: 'create',
  text: 'Great run this morning',
  photos: [] as string[],
  postId: '',
  clientId: 'client-1',
  deadline: NOW + 60,
  ...over,
});

function setup(verify = vi.fn(async () => true)) {
  const store = memoryStore();
  const service = createPostService({ store, verify, now: () => NOW });
  return { store, service, verify };
}

describe('creating a post', () => {
  it('stores what the author signed, with the time it was posted', async () => {
    const { service, store } = setup();

    const result = await service.apply({ intent: create(), signature: SIGNATURE });

    expect(result.post).toMatchObject({
      author: ME,
      text: 'Great run this morning',
      createdAt: NOW,
    });
    expect(store.records).toHaveLength(1);
  });

  it('can be photos only, or text only, but not nothing', async () => {
    const { service } = setup();

    await service.apply({ intent: create({ text: '', photos: [CID] }), signature: SIGNATURE });
    await service.apply({ intent: create({ text: 'hi' }), signature: SIGNATURE });
    await expect(
      service.apply({ intent: create({ text: '  ', photos: [] }), signature: SIGNATURE })
    ).rejects.toMatchObject({ code: 'invalid' });
  });

  it('refuses a post the author did not sign', async () => {
    const { service, store } = setup(vi.fn(async () => false));

    await expect(service.apply({ intent: create(), signature: SIGNATURE })).rejects.toMatchObject({
      code: 'bad_signature',
    });
    expect(store.records).toEqual([]);
  });

  it('refuses an expired or too-far-ahead request', async () => {
    const { service } = setup();

    await expect(
      service.apply({ intent: create({ deadline: NOW - 1 }), signature: SIGNATURE })
    ).rejects.toMatchObject({ code: 'expired' });
    await expect(
      service.apply({ intent: create({ deadline: NOW + 100_000 }), signature: SIGNATURE })
    ).rejects.toMatchObject({ code: 'expired' });
  });

  it('trims the text and rejects too long text, control characters and bad photos', async () => {
    const { service, store } = setup();

    await service.apply({ intent: create({ text: '  hello  ' }), signature: SIGNATURE });
    expect(store.records[0]?.text).toBe('hello');

    for (const bad of [
      create({ text: 'x'.repeat(MAX_POST_LENGTH + 1) }),
      create({ text: 'bell\u0007' }),
      create({ photos: Array.from({ length: MAX_PHOTOS + 1 }, () => CID) }),
      create({ photos: ['not a cid'] }),
      create({ photos: 'bafy' }),
      create({ text: 5 }),
      create({ postId: 'post-1' }),
    ]) {
      await expect(service.apply({ intent: bad, signature: SIGNATURE })).rejects.toBeInstanceOf(
        PostError
      );
    }
  });

  it('allows line breaks in the text, up to a few', async () => {
    const { service, store } = setup();

    await service.apply({ intent: create({ text: 'one\ntwo\n\nthree' }), signature: SIGNATURE });

    expect(store.records[0]?.text).toBe('one\ntwo\n\nthree');
  });

  it('stops an author posting more than the daily limit, since each post costs the server', async () => {
    const { service, store } = setup();
    for (let i = 0; i < MAX_POSTS_PER_DAY; i++) {
      store.records.push({
        id: `old-${i}`,
        author: ME,
        text: 'x',
        photos: [],
        createdAt: NOW - 100,
        clientId: `old-${i}`,
      });
    }

    await expect(service.apply({ intent: create(), signature: SIGNATURE })).rejects.toMatchObject({
      code: 'rate_limited',
    });
    await expect(
      service.apply({ intent: create({ author: THEM }), signature: SIGNATURE })
    ).resolves.toBeDefined();
  });
});

describe('retrying a post', () => {
  const idOf = (result: unknown) => (result as { post: { id: string } }).post.id;

  it('returns the post that was already stored for the same client id instead of publishing it twice', async () => {
    const { service, store } = setup();

    const first = await service.apply({ intent: create(), signature: SIGNATURE });
    const second = await service.apply({
      intent: create({ deadline: NOW + 90 }),
      signature: '0xanother-signature',
    });

    expect(idOf(second)).toBe(idOf(first));
    expect(store.records).toHaveLength(1);
  });

  it('treats the same client id from another author as a different post', async () => {
    const { service, store } = setup();

    await service.apply({ intent: create(), signature: SIGNATURE });
    await service.apply({ intent: create({ author: THEM }), signature: SIGNATURE });

    expect(store.records).toHaveLength(2);
  });

  it('does not count a retry against the daily limit', async () => {
    const { service, store } = setup();
    const first = await service.apply({ intent: create(), signature: SIGNATURE });
    for (let i = 0; i < MAX_POSTS_PER_DAY - 1; i++) {
      store.records.push({
        id: `old-${i}`,
        author: ME,
        text: 'x',
        photos: [],
        createdAt: NOW - 100,
        clientId: `old-${i}`,
      });
    }

    const retry = await service.apply({ intent: create(), signature: SIGNATURE });

    expect(idOf(retry)).toBe(idOf(first));
  });

  it('needs a client id to create, and none to delete', async () => {
    const { service } = setup();

    await expect(
      service.apply({ intent: create({ clientId: '' }), signature: SIGNATURE })
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      service.apply({ intent: create({ clientId: 'has space' }), signature: SIGNATURE })
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      service.apply({
        intent: create({ action: 'delete', text: '', postId: 'post-1', clientId: 'x' }),
        signature: SIGNATURE,
      })
    ).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('deleting a post', () => {
  const del = (postId: string, over: Record<string, unknown> = {}) =>
    create({ action: 'delete', text: '', photos: [], postId, clientId: '', ...over });

  it('removes the author’s own post', async () => {
    const { service, store } = setup();
    const { post } = await service.apply({ intent: create(), signature: SIGNATURE });
    if (!post) throw new Error('create returned no post');

    await service.apply({ intent: del(post.id), signature: SIGNATURE });

    expect(store.records).toEqual([]);
  });

  it('will not remove someone else’s post', async () => {
    const { service, store } = setup();
    const { post } = await service.apply({
      intent: create({ author: THEM }),
      signature: SIGNATURE,
    });
    if (!post) throw new Error('create returned no post');

    await expect(
      service.apply({ intent: del(post.id), signature: SIGNATURE })
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(store.records).toHaveLength(1);
  });

  it('treats a post that is already gone as removed', async () => {
    const { service } = setup();

    await expect(service.apply({ intent: del('missing'), signature: SIGNATURE })).resolves.toEqual({
      deleted: true,
    });
  });

  it('needs a post id and no text', async () => {
    const { service } = setup();

    await expect(service.apply({ intent: del(''), signature: SIGNATURE })).rejects.toMatchObject({
      code: 'invalid',
    });
    await expect(
      service.apply({ intent: del('post-1', { text: 'sneaky' }), signature: SIGNATURE })
    ).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('reading posts', () => {
  it('lists the newest posts of the authors asked about', async () => {
    const { service, store } = setup();
    store.records.push(
      { id: 'a', author: ME, text: 'old', photos: [], createdAt: 10, clientId: 'a' },
      { id: 'b', author: THEM, text: 'new', photos: [], createdAt: 20, clientId: 'b' },
      {
        id: 'c',
        author: '0x00000000000000000000000000000000000000cc',
        text: 'x',
        photos: [],
        createdAt: 30,
        clientId: 'c',
      }
    );

    const { posts } = await service.forAuthors([ME, THEM], 10);

    expect(posts.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('bounds the author list and the number of posts returned', async () => {
    const { service } = setup();

    await expect(service.forAuthors('nope', 10)).rejects.toMatchObject({ code: 'invalid' });
    await expect(service.forAuthors(['bad'], 10)).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      service.forAuthors(
        Array.from({ length: 101 }, () => ME),
        10
      )
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(service.forAuthors([ME], 0)).rejects.toMatchObject({ code: 'invalid' });
    await expect(service.forAuthors([ME], 1000)).rejects.toMatchObject({ code: 'invalid' });
  });
});
