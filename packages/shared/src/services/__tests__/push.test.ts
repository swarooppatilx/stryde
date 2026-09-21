import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setIpfsConfig } from '../ipfs';
import { pushTypedData } from '../pushIntent';

const getActiveConfig = vi.hoisted(() => vi.fn(() => ({ chain: { id: 11155111 } })));
vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  getActiveConfig,
}));

const { registerPushToken, unregisterPushToken } = await import('../push');

const account = privateKeyToAccount(`0x${'55'.repeat(32)}`);
const wallet = {
  account,
  signTypedData: (typed: Parameters<typeof account.signTypedData>[0]) =>
    account.signTypedData(typed),
} as never;
const fetchMock = vi.fn();
const registration = { token: 'ExponentPushToken[abc]', platform: 'android' } as const;

beforeEach(() => {
  setIpfsConfig({ apiUrl: 'https://api.test', apiKey: 'k' });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('push registration', () => {
  it('signs a PushToken intent and posts it to /api/push/register', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ registered: true, created: true }), { status: 200 })
    );

    const result = await registerPushToken(wallet, registration);

    expect(result).toEqual({ registered: true, created: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://api.test/api/push/register');
    const { intent, signature } = JSON.parse(init.body);
    expect(intent).toMatchObject({ ...registration, action: 'register', owner: account.address });
    expect(
      await verifyTypedData({
        address: account.address,
        signature,
        ...pushTypedData({ ...intent }, 11155111),
      })
    ).toBe(true);
  });

  it('unregisters on its own path with its own action', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ registered: false }), { status: 200 })
    );

    await unregisterPushToken(wallet, registration);

    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://api.test/api/push/unregister');
    expect(JSON.parse(init.body).intent.action).toBe('unregister');
  });
});
