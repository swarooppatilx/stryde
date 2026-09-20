import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setIpfsConfig } from '../ipfs';
import { postTypedData } from '../postIntent';

const getActiveConfig = vi.hoisted(() => vi.fn(() => ({ chain: { id: 11155111 } })));
vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  getActiveConfig,
}));

const { createPost, deletePost, getPosts } = await import('../posts');

const account = privateKeyToAccount(`0x${'44'.repeat(32)}`);
const wallet = {
  account,
  signTypedData: (typed: Parameters<typeof account.signTypedData>[0]) =>
    account.signTypedData(typed),
} as never;
const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

const fetchMock = vi.fn();

function firstCall(): [string, RequestInit & { headers: Record<string, string>; body: string }] {
  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error('fetch was not called');
  return call as never;
}

beforeEach(() => {
  setIpfsConfig({ apiUrl: 'https://api.test', apiKey: 'k' });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('createPost', () => {
  it('signs the trimmed post with the wallet and sends it to the API', async () => {
    const post = { id: 'p1', author: account.address, text: 'hi', photos: [CID], createdAt: 1 };
    fetchMock.mockResolvedValue(ok({ post }));

    const result = await createPost(wallet, { text: '  hi ', photos: [CID], clientId: 'client-1' });

    expect(result).toEqual(post);
    const [url, init] = firstCall();
    expect(url).toBe('https://api.test/api/social/post');
    expect(init.headers['X-API-Key']).toBe('k');
    const { intent, signature } = JSON.parse(init.body);
    expect(intent).toMatchObject({
      author: account.address,
      action: 'create',
      text: 'hi',
      photos: [CID],
      postId: '',
      clientId: 'client-1',
    });
    expect(
      await verifyTypedData({
        address: account.address,
        signature,
        ...postTypedData(intent, 11155111),
      })
    ).toBe(true);
  });

  it('needs a wallet account', async () => {
    await expect(createPost({} as never, { text: 'x', photos: [], clientId: 'c' })).rejects.toThrow(
      'No wallet account found'
    );
  });

  it('passes the server’s refusal on', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'You have posted a lot today' }), { status: 429 })
    );

    await expect(createPost(wallet, { text: 'x', photos: [], clientId: 'c' })).rejects.toThrow(
      'You have posted a lot today'
    );
  });
});

describe('deletePost', () => {
  it('signs a delete for that post id', async () => {
    fetchMock.mockResolvedValue(ok({ deleted: true }));

    await deletePost(wallet, 'post-1');

    const { intent, signature } = JSON.parse(firstCall()[1].body);
    expect(intent).toMatchObject({
      action: 'delete',
      postId: 'post-1',
      text: '',
      photos: [],
      clientId: '',
    });
    expect(
      await verifyTypedData({
        address: account.address,
        signature,
        ...postTypedData(intent, 11155111),
      })
    ).toBe(true);
  });
});

describe('getPosts', () => {
  it('asks for the authors’ newest posts in one call', async () => {
    const a = '0x00000000000000000000000000000000000000aa';
    const b = '0x00000000000000000000000000000000000000bb';
    fetchMock.mockResolvedValue(ok({ posts: [{ id: 'p1' }] }));

    const posts = await getPosts([a, b] as `0x${string}`[], 10);

    expect(firstCall()[0]).toBe(`https://api.test/api/social/posts?authors=${a},${b}&limit=10`);
    expect(posts).toEqual([{ id: 'p1' }]);
  });

  it('does not call the API for an empty list', async () => {
    expect(await getPosts([], 10)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
