import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { followTypedData } from '../followIntent';
import { setIpfsConfig } from '../ipfs';

const getActiveConfig = vi.hoisted(() => vi.fn(() => ({ chain: { id: 11155111 } })));
vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  getActiveConfig,
}));

const { getFollowers, getFollowing, setFollowing } = await import('../follows');

const account = privateKeyToAccount(`0x${'44'.repeat(32)}`);
const THEM = '0x00000000000000000000000000000000000000bb' as const;
const wallet = {
  account,
  signTypedData: (typed: Parameters<typeof account.signTypedData>[0]) =>
    account.signTypedData(typed),
} as never;

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

describe('setFollowing', () => {
  it('signs a Follow intent with the wallet and sends it to the API', async () => {
    fetchMock.mockResolvedValue(ok({ following: true, created: true }));

    const result = await setFollowing(wallet, THEM, true);

    expect(result).toEqual({ following: true, created: true });
    const [url, init] = firstCall();
    expect(url).toBe('https://api.test/api/social/follow');
    expect(init.headers['X-API-Key']).toBe('k');
    const { intent, signature } = JSON.parse(init.body);
    expect(intent).toMatchObject({ follower: account.address, followee: THEM, action: 'follow' });
    expect(
      await verifyTypedData({
        address: account.address,
        signature,
        ...followTypedData(intent, 11155111),
      })
    ).toBe(true);
  });

  it('asks to unfollow when told to', async () => {
    fetchMock.mockResolvedValue(ok({ following: false, created: false }));

    await setFollowing(wallet, THEM, false);

    expect(JSON.parse(firstCall()[1].body).intent.action).toBe('unfollow');
  });

  it('throws the API’s message when it refuses', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'The request has expired; try again' }), { status: 400 })
    );

    await expect(setFollowing(wallet, THEM, true)).rejects.toThrow('The request has expired');
  });

  it('refuses a wallet that has no account', async () => {
    await expect(setFollowing({} as never, THEM, true)).rejects.toThrow(/No wallet account/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('needs the API to be configured', async () => {
    setIpfsConfig(null as never);

    await expect(setFollowing(wallet, THEM, true)).rejects.toThrow(/not configured/i);
  });
});

describe('reading the graph', () => {
  it('loads who a wallet follows', async () => {
    fetchMock.mockResolvedValue(ok({ addresses: [THEM], truncated: false }));

    expect(await getFollowing(account.address)).toEqual({ addresses: [THEM], truncated: false });
    expect(firstCall()[0]).toBe(`https://api.test/api/social/following/${account.address}`);
  });

  it('loads a wallet’s followers', async () => {
    fetchMock.mockResolvedValue(ok({ addresses: [], truncated: false }));

    await getFollowers(THEM);

    expect(firstCall()[0]).toBe(`https://api.test/api/social/followers/${THEM}`);
  });

  it('throws when the API fails, so callers keep what they had', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

    await expect(getFollowing(THEM)).rejects.toThrow();
  });
});
