import { describe, expect, it, vi } from 'vitest';
import { arkivConfigFromEnv, arkivSignerFromEnv, createArkivPublicClient } from '../arkiv.js';
import { ConfigError } from '../relayErrors.js';

const OFFICIAL = 'https://rpc.rabdi.db-chain.testnet.arkiv.network';

function rpcFetch() {
  return vi.fn(async (_url: unknown, init?: { headers?: HeadersInit }) => {
    void init;
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x7614d1' }), {
      headers: { 'content-type': 'application/json' },
    });
  });
}

function sentHeaders(fetchFn: ReturnType<typeof rpcFetch>): Headers {
  const request = fetchFn.mock.calls[0]?.[0];
  const init = fetchFn.mock.calls[0]?.[1];
  return new Headers(request instanceof Request ? request.headers : init?.headers);
}

describe('createArkivPublicClient', () => {
  it('sends the access key in X-API-KEY to the official RPC', async () => {
    const fetchFn = rpcFetch();
    const client = createArkivPublicClient({ accessKey: 'ark_test', fetchFn: fetchFn as never });

    await client.getChainId();

    expect(sentHeaders(fetchFn).get('x-api-key')).toBe('ark_test');
  });

  it('sends no key header when none is configured', async () => {
    const fetchFn = rpcFetch();

    await createArkivPublicClient({ fetchFn: fetchFn as never }).getChainId();

    expect(sentHeaders(fetchFn).get('x-api-key')).toBeNull();
  });

  it('refuses to attach the key to any other origin', () => {
    expect(() =>
      createArkivPublicClient({ rpcUrl: 'https://evil.example/rpc', accessKey: 'ark_test' })
    ).toThrow(/origin/i);
  });

  it('talks to the Rabdi chain', () => {
    expect(createArkivPublicClient({ rpcUrl: OFFICIAL }).chain.id).toBe(7794095);
  });

  it('never puts the access key in the request URL, where logs would keep it', async () => {
    const fetchFn = rpcFetch();

    await createArkivPublicClient({
      accessKey: 'ark_secret',
      fetchFn: fetchFn as never,
    }).getChainId();

    const request = fetchFn.mock.calls[0]?.[0];
    const url = request instanceof Request ? request.url : String(request);
    expect(url).not.toContain('ark_secret');
  });
});

describe('arkivConfigFromEnv', () => {
  it('reads the optional access key', () => {
    expect(arkivConfigFromEnv({ ARKIV_ACCESS_KEY: 'k' }).accessKey).toBe('k');
    expect(arkivConfigFromEnv({}).accessKey).toBeUndefined();
  });

  it('prefers the Rabdi key, since keys are issued per network', () => {
    expect(
      arkivConfigFromEnv({ ARKIV_RABDI_ACCESS_KEY: 'rabdi', ARKIV_ACCESS_KEY: 'old' }).accessKey
    ).toBe('rabdi');
  });

  it('treats an empty value as not set', () => {
    expect(arkivConfigFromEnv({ ARKIV_ACCESS_KEY: '' }).accessKey).toBeUndefined();
  });
});

describe('arkivSignerFromEnv', () => {
  const KEY = `0x${'11'.repeat(32)}`;

  it('builds the signer account from a 32-byte hex key', () => {
    expect(arkivSignerFromEnv({ ARKIV_PRIVATE_KEY: KEY }).address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('reports missing configuration without echoing anything', () => {
    expect(() => arkivSignerFromEnv({})).toThrow(ConfigError);
  });

  it('rejects a malformed key without repeating it', () => {
    let message = '';
    try {
      arkivSignerFromEnv({ ARKIV_PRIVATE_KEY: 'not-a-key' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain('not-a-key');
    expect(message).toMatch(/ARKIV_PRIVATE_KEY/);
  });
});
