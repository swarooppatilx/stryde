import { describe, expect, it, vi } from 'vitest';
import { createGatewayFetch } from '../ipfsGatewayFetch.js';

const CID = 'QmRP4i9LZvW8VxvKAkpw6CBZBNwU5Kw8SCEENnfwaqGGCp';
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

describe('createGatewayFetch', () => {
  it('fetches the CID from the gateway and parses the JSON', async () => {
    const fetchImpl = vi.fn(async () => json({ name: 'Run' }));
    const get = createGatewayFetch({ fetchImpl, gateway: 'https://gw.example/ipfs/' });
    expect(await get(CID)).toEqual({ name: 'Run' });
    expect(fetchImpl).toHaveBeenCalledWith(`https://gw.example/ipfs/${CID}`, expect.anything());
  });

  it('refuses anything that is not shaped like a CID, before making a request', async () => {
    const fetchImpl = vi.fn();
    const get = createGatewayFetch({ fetchImpl, gateway: 'https://gw.example/ipfs/' });
    for (const bad of ['../etc/passwd', `${CID}/../x`, 'short', `${CID}?x=1`, `${CID}#y`, '']) {
      await expect(get(bad)).rejects.toThrow('not a CID');
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws on a failed response', async () => {
    const get = createGatewayFetch({ fetchImpl: async () => new Response('no', { status: 504 }) });
    await expect(get(CID)).rejects.toThrow('504');
  });

  it('refuses a body larger than the cap, so one bad CID cannot fill memory', async () => {
    const big = 'x'.repeat(300_000);
    const get = createGatewayFetch({ fetchImpl: async () => json({ big }), maxBytes: 256 * 1024 });
    await expect(get(CID)).rejects.toThrow('too large');
  });
});
