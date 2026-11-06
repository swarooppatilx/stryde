import { afterEach, describe, expect, it } from 'vitest';
import { setIpfsConfig } from '../ipfs';
import { routingErrorMessage, snapRoute } from '../routing';

const A: [number, number] = [73.8567, 18.5204];
const B: [number, number] = [73.865, 18.525];

function api(status: number, body: unknown) {
  const seen: { url: string; init?: RequestInit }[] = [];
  setIpfsConfig({
    apiUrl: 'http://api.test',
    apiKey: 'k',
    fetch: (async (url: string, init?: RequestInit) => {
      seen.push({ url, init });
      return new Response(JSON.stringify(body), { status });
    }) as typeof fetch,
  });
  return seen;
}

afterEach(() => setIpfsConfig(undefined as never));

describe('snapRoute', () => {
  it('posts the profile and points to the routing API and returns the snapped line', async () => {
    const seen = api(200, { coordinates: [A, B], distance: 1237, duration: 990 });

    const result = await snapRoute('foot', [A, B]);

    expect(result).toEqual({ ok: true, coordinates: [A, B], distance: 1237, duration: 990 });
    expect(seen[0]?.url).toBe('http://api.test/api/routing/route');
    expect(JSON.parse(String(seen[0]?.init?.body))).toEqual({ profile: 'foot', points: [A, B] });
    expect(seen[0]?.init?.method).toBe('POST');
  });

  it('reports no_route for the 422 the API sends for an unroutable pair', async () => {
    api(422, { error: 'no_route' });
    expect(await snapRoute('bike', [A, B])).toEqual({ ok: false, reason: 'no_route' });
  });

  it('reports unavailable for an outage, a network error, or any other failure', async () => {
    api(502, { error: 'routing_unavailable' });
    expect(await snapRoute('foot', [A, B])).toEqual({ ok: false, reason: 'unavailable' });

    setIpfsConfig({
      apiUrl: 'http://api.test',
      fetch: (async () => {
        throw new Error('offline');
      }) as typeof fetch,
    });
    expect(await snapRoute('foot', [A, B])).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('reports not_configured when the app has no API, so the builder stays on straight lines quietly', async () => {
    expect(await snapRoute('foot', [A, B])).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('refuses fewer than two points without calling the API', async () => {
    const seen = api(200, {});
    expect(await snapRoute('foot', [A])).toEqual({ ok: false, reason: 'invalid' });
    expect(seen).toHaveLength(0);
  });
});

describe('routingErrorMessage', () => {
  it('uses plain copy for the failures a user can act on', () => {
    expect(routingErrorMessage('no_route')).toBe("We can't route to this point");
    expect(routingErrorMessage('unavailable')).toBe('Something went wrong. Try again later.');
  });

  it('says nothing when routing is simply not set up', () => {
    expect(routingErrorMessage('not_configured')).toBeNull();
  });
});
