import { afterEach, describe, expect, it, vi } from 'vitest';
import { setIpfsConfig } from '../ipfs';
import { socialCall } from '../socialApi';

afterEach(() => vi.unstubAllGlobals());

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status }))
  );
}

describe('socialCall', () => {
  setIpfsConfig({ apiUrl: 'http://api.test' });

  it('returns the parsed body on success', async () => {
    respond(200, { ok: true });
    await expect(socialCall('x')).resolves.toEqual({ ok: true });
  });

  it('throws the server message with the HTTP status, so callers can tell a refusal from an outage', async () => {
    respond(401, { error: 'bad signature' });

    const error = await socialCall('x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('bad signature');
    expect((error as { status?: number }).status).toBe(401);
  });

  it('falls back to a generic message when the body has none', async () => {
    respond(503, {});

    const error = await socialCall('x').catch((e: unknown) => e);

    expect((error as Error).message).toBe('Request failed: 503');
    expect((error as { status?: number }).status).toBe(503);
  });
});

describe('socialCall with an injected fetch', () => {
  afterEach(() => setIpfsConfig({ apiUrl: 'http://api.test' }));

  it('uses the fetch the config carries instead of the global one, for the same URL and headers', async () => {
    const globalFetch = vi.fn();
    vi.stubGlobal('fetch', globalFetch);
    const injected = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    setIpfsConfig({ apiUrl: 'http://api.test', apiKey: 'k', fetch: injected as never });

    await expect(socialCall('follow', { method: 'POST' })).resolves.toEqual({ ok: 1 });

    expect(globalFetch).not.toHaveBeenCalled();
    expect(injected).toHaveBeenCalledWith(
      'http://api.test/api/social/follow',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Key': 'k' }),
      })
    );
  });
});
