import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setIpfsConfig } from '../ipfs';
import { reportTypedData } from '../reportIntent';

const getActiveConfig = vi.hoisted(() => vi.fn(() => ({ chain: { id: 11155111 } })));
vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  getActiveConfig,
}));

const { sendReport } = await import('../reports');

const account = privateKeyToAccount(`0x${'44'.repeat(32)}`);
const wallet = {
  account,
  signTypedData: (typed: Parameters<typeof account.signTypedData>[0]) =>
    account.signTypedData(typed),
} as never;
const fetchMock = vi.fn();

beforeEach(() => {
  setIpfsConfig({ apiUrl: 'https://api.test', apiKey: 'k' });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('sendReport', () => {
  it('signs a Report intent with the wallet and sends it to the API', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ reported: true, created: true }), { status: 200 })
    );

    const result = await sendReport(wallet, {
      targetKind: 'comment',
      targetId: 'c1',
      reason: 'abusive',
      note: ' rude ',
    });

    expect(result).toEqual({ reported: true, created: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://api.test/api/social/report');
    const { intent, signature } = JSON.parse(init.body);
    expect(intent).toMatchObject({ targetKind: 'comment', targetId: 'c1', note: 'rude' });
    expect(
      await verifyTypedData({
        address: account.address,
        signature,
        ...reportTypedData(intent, 11155111),
      })
    ).toBe(true);
  });

  it('sends an empty note when none is given', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    await sendReport(wallet, { targetKind: 'user', targetId: '0xabc', reason: 'spam' });

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body).intent.note).toBe('');
  });
});
