import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChainOfflineError, getPublicClient, getWalletClient, setChainOffline } from '../client';
import { querySubgraph } from '../subgraphClient';

afterEach(() => {
  setChainOffline(false);
  vi.unstubAllGlobals();
});

describe('chain offline switch', () => {
  it('makes chain reads fail at once, without touching the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    setChainOffline(true);

    await expect(
      getPublicClient().getBalance({ address: '0x00000000000000000000000000000000000000aa' })
    ).rejects.toThrow(/switched off/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('makes chain writes fail at once too', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    setChainOffline(true);
    const wallet = getWalletClient(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    );

    await expect(
      wallet.sendTransaction({
        account: wallet.account ?? '0x00000000000000000000000000000000000000aa',
        chain: wallet.chain,
        to: '0x00000000000000000000000000000000000000bb',
        value: 1n,
      })
    ).rejects.toThrow(/switched off/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('makes subgraph queries fail at once', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    setChainOffline(true);

    await expect(querySubgraph('http://graph.test', '{ x }')).rejects.toThrow(ChainOfflineError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('goes back to the real network when switched off', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ data: { ok: true } })));
    vi.stubGlobal('fetch', fetchSpy);
    setChainOffline(true);
    setChainOffline(false);

    await expect(querySubgraph('http://graph.test', '{ x }')).resolves.toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalled();
  });
});
