import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const token = vi.hoisted(() => ({ value: 'jwt' as string | null }));
vi.mock('@privy-io/expo', () => ({ getAccessToken: async () => token.value }));

import { fetchPrivyMetadata, updatePrivyMetadata } from '@/services/profileService';

function respond(status: number, body: unknown = {}) {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Privy metadata', () => {
  beforeEach(() => {
    token.value = 'jwt';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads the custom metadata with the access token', async () => {
    const fetchMock = respond(200, { user: { custom_metadata: { username: 'asha' } } });

    expect(await fetchPrivyMetadata('did:privy:1')).toEqual({ username: 'asha' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.privy.io/api/v1/users/did:privy:1',
      expect.objectContaining({ headers: { Authorization: 'Bearer jwt' } })
    );
  });

  it('returns null when signed out, without calling Privy', async () => {
    token.value = null;
    const fetchMock = respond(200);

    expect(await fetchPrivyMetadata('did:privy:1')).toBeNull();
    expect(await updatePrivyMetadata('did:privy:1', { username: 'x' })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null for a user with no metadata or a failed request', async () => {
    respond(200, { user: {} });
    expect(await fetchPrivyMetadata('u')).toBeNull();

    respond(500);
    expect(await fetchPrivyMetadata('u')).toBeNull();
  });

  it('writes metadata and reports whether Privy accepted it', async () => {
    const fetchMock = respond(200);
    expect(await updatePrivyMetadata('u', { username: 'asha' })).toBe(true);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ custom_metadata: { username: 'asha' } });

    respond(400);
    expect(await updatePrivyMetadata('u', { username: 'asha' })).toBe(false);
  });

  it('swallows a network failure instead of throwing into the UI', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline');
    });

    expect(await fetchPrivyMetadata('u')).toBeNull();
    expect(await updatePrivyMetadata('u', { username: 'a' })).toBe(false);
  });
});
