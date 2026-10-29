import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/constants/config', () => ({ getLocalRpcUrl: () => 'http://anvil:8545' }));

import { ensureLocalWalletFunded } from '@/utils/anvilFaucet';

const ETH = 10n ** 18n;
const hex = (wei: bigint) => `0x${wei.toString(16)}`;

/** Answers eth_getBalance with `balance`, anvil_setBalance with `fund`. */
function chain(balance: bigint, fund: object = { result: null }) {
  const methods: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      const { method } = JSON.parse(init.body) as { method: string };
      methods.push(method);
      return Response.json(method === 'eth_getBalance' ? { result: hex(balance) } : fund);
    })
  );
  return methods;
}

describe('ensureLocalWalletFunded', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('leaves a wallet alone when it already has 10 ETH', async () => {
    const methods = chain(10n * ETH);

    expect(await ensureLocalWalletFunded()).toBe('already-funded');
    expect(methods).toEqual(['eth_getBalance']);
  });

  it('tops up a nearly empty wallet', async () => {
    const methods = chain(ETH);

    expect(await ensureLocalWalletFunded()).toBe('funded');
    expect(methods).toEqual(['eth_getBalance', 'anvil_setBalance']);
  });

  it('reports a failure when the node refuses', async () => {
    chain(0n, { error: { message: 'method not found' } });

    expect(await ensureLocalWalletFunded()).toBe('failed');
  });

  it('reports a failure when no node is running', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Network request failed');
      })
    );

    expect(await ensureLocalWalletFunded()).toBe('failed');
  });
});
