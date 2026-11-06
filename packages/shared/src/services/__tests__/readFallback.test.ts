import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getActiveConfig, getPublicClient, setChainMode } from '../client';

const PRIMARY = 'https://ethereum-sepolia-rpc.publicnode.com';

type Reply = { error?: { code: number; message: string }; result?: unknown };

function stubRpc(byHost: Record<string, (method: string) => Reply>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { body: string }) => {
      const { id, method } = JSON.parse(init.body) as { id: number; method: string };
      const host = new URL(url).host;
      calls.push(`${host} ${method}`);
      const reply = byHost[host]?.(method) ?? { error: { code: -32601, message: 'no such host' } };
      return new Response(JSON.stringify({ jsonrpc: '2.0', id, ...reply }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    })
  );
  return calls;
}

beforeEach(() => setChainMode('ethereum-sepolia'));
afterEach(() => vi.unstubAllGlobals());

describe('chain reads', () => {
  it('has a fallback RPC next to the primary for Sepolia', () => {
    const { rpcUrl, fallbackRpcUrls } = getActiveConfig();
    expect(rpcUrl).toBe(PRIMARY);
    expect(fallbackRpcUrls?.length).toBeGreaterThan(0);
  });

  it('asks the fallback RPC when the primary has pruned the history', async () => {
    const fallbackHost = new URL(getActiveConfig().fallbackRpcUrls?.[0] ?? '').host;
    const calls = stubRpc({
      'ethereum-sepolia-rpc.publicnode.com': () => ({
        error: { code: -32000, message: 'pruned history unavailable' },
      }),
      [fallbackHost]: (method) => (method === 'eth_getLogs' ? { result: [] } : { result: '0x1' }),
    });

    const logs = await getPublicClient().getLogs({ fromBlock: 1n, toBlock: 2n });

    expect(logs).toEqual([]);
    expect(calls).toContain(`${fallbackHost} eth_getLogs`);
  });
});
