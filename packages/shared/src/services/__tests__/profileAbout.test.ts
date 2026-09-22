import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setIpfsConfig } from '../ipfs';
import { aboutTypedData } from '../profileAboutIntent';

const getActiveConfig = vi.hoisted(() => vi.fn(() => ({ chain: { id: 11155111 } })));
vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  getActiveConfig,
}));

const { getAbout, setAbout } = await import('../profileAbout');

const account = privateKeyToAccount(`0x${'44'.repeat(32)}`);
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

describe('setAbout', () => {
  it('signs the trimmed text with the wallet and sends it to the API', async () => {
    fetchMock.mockResolvedValue(ok({ about: { bio: 'hi', location: 'Pune' } }));

    const result = await setAbout(wallet, { bio: '  hi ', location: 'Pune  ' });

    expect(result).toEqual({ bio: 'hi', location: 'Pune' });
    const [url, init] = firstCall();
    expect(url).toBe('https://api.test/api/social/about');
    expect(init.headers['X-API-Key']).toBe('k');
    const { intent, signature } = JSON.parse(init.body);
    expect(intent).toMatchObject({ author: account.address, bio: 'hi', location: 'Pune' });
    expect(
      await verifyTypedData({
        address: account.address,
        signature,
        ...aboutTypedData(intent, 11155111),
      })
    ).toBe(true);
  });

  it('needs a wallet account', async () => {
    await expect(setAbout({} as never, { bio: '', location: '' })).rejects.toThrow(
      'No wallet account found'
    );
  });

  it('passes the server’s refusal on', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'bio is at most 160 characters' }), { status: 400 })
    );

    await expect(setAbout(wallet, { bio: 'x', location: '' })).rejects.toThrow(
      'bio is at most 160 characters'
    );
  });
});

describe('getAbout', () => {
  it('asks for the authors in one call and returns the map', async () => {
    const a = '0x00000000000000000000000000000000000000aa';
    const b = '0x00000000000000000000000000000000000000bb';
    fetchMock.mockResolvedValue(ok({ about: { [a]: { bio: 'hi', location: '' } } }));

    const result = await getAbout([a, b] as `0x${string}`[]);

    expect(firstCall()[0]).toBe(`https://api.test/api/social/about?authors=${a},${b}`);
    expect(result).toEqual({ [a]: { bio: 'hi', location: '' } });
  });

  it('does not call the API for an empty list', async () => {
    expect(await getAbout([])).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
