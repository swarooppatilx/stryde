import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_DELETE_INTENT_TTL_SECONDS,
  accountDeleteTypedData,
  newAccountDeleteIntent,
} from '../accountDeleteIntent';
import { setIpfsConfig } from '../ipfs';

const getActiveConfig = vi.hoisted(() => vi.fn(() => ({ chain: { id: 11155111 } })));
vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  getActiveConfig,
}));

const { deleteAccountData } = await import('../account');

const account = privateKeyToAccount(`0x${'66'.repeat(32)}`);
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

describe('newAccountDeleteIntent', () => {
  it('expires a couple of minutes from now', () => {
    const owner = account.address;
    expect(newAccountDeleteIntent({ owner }, 1_000)).toEqual({
      owner,
      deadline: 1_000 + ACCOUNT_DELETE_INTENT_TTL_SECONDS,
    });
  });
});

describe('accountDeleteTypedData', () => {
  it('describes one AccountDelete message bound to a chain', () => {
    const intent = newAccountDeleteIntent({ owner: account.address }, 10);
    const typed = accountDeleteTypedData(intent, 11155111);

    expect(typed.primaryType).toBe('AccountDelete');
    expect(typed.domain).toEqual({ name: 'Stryde Social', version: '1', chainId: 11155111 });
    expect(typed.message).toEqual({ ...intent, deadline: BigInt(intent.deadline) });
  });
});

describe('deleteAccountData', () => {
  it('signs the intent and posts it to /api/account/delete', async () => {
    const counts = { follows: 2, posts: 1 };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ deleted: true, counts }), { status: 200 })
    );

    const result = await deleteAccountData(wallet);

    expect(result).toEqual({ deleted: true, counts });
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];
    expect(url).toBe('https://api.test/api/account/delete');
    expect(init.method).toBe('POST');
    const { intent, signature } = JSON.parse(init.body);
    expect(intent.owner).toBe(account.address);
    expect(
      await verifyTypedData({
        address: account.address,
        signature,
        ...accountDeleteTypedData(intent, 11155111),
      })
    ).toBe(true);
  });

  it('refuses without a wallet account', async () => {
    await expect(deleteAccountData({} as never)).rejects.toThrow('No wallet account found');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
