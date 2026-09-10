import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJsonFromIpfs, ipfsToHttpUrl, setIpfsConfig, uploadJsonToIpfs } from '../ipfs';

// Must run before any other test in this file sets a config, since
// ipfsConfig is shared module-level state with no reset hook other than
// setIpfsConfig itself.
it('uploadJsonToIpfs throws when IPFS has not been configured yet', async () => {
  await expect(uploadJsonToIpfs('name', { a: 1 })).rejects.toThrow(/not configured/i);
});

describe('ipfsToHttpUrl', () => {
  it('builds a Pinata gateway URL from a CID', () => {
    expect(ipfsToHttpUrl('bafyabc123')).toBe('https://gateway.pinata.cloud/ipfs/bafyabc123');
  });
});

describe('uploadJsonToIpfs', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setIpfsConfig({ apiUrl: 'https://api.example.com', apiKey: 'test-key' });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('posts to the relay API and returns the cid', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cid: 'bafyxyz', size: 42 }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await uploadJsonToIpfs('activity-metadata', { name: 'Morning Run' });

    expect(result).toEqual({ cid: 'bafyxyz', size: 42 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/ipfs/upload',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Key': 'test-key' }),
      })
    );
  });

  it('throws when the relay API responds with no cid', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(uploadJsonToIpfs('name', {})).rejects.toThrow(/no cid/i);
  });

  it('throws when the relay API responds with an error status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => 'pinata down',
    }) as unknown as typeof fetch;

    await expect(uploadJsonToIpfs('name', {})).rejects.toThrow(/upload failed/i);
  });
});

describe('fetchJsonFromIpfs', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Morning Run', description: 'Nice loop' }),
    }) as unknown as typeof fetch;

    const result = await fetchJsonFromIpfs('bafyxyz');
    expect(result).toEqual({ name: 'Morning Run', description: 'Nice loop' });
  });

  it('returns null (not throw) when the gateway responds with an error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    const result = await fetchJsonFromIpfs('bafyxyz');
    expect(result).toBeNull();
  });

  it('returns null (not throw) when the fetch itself throws', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const result = await fetchJsonFromIpfs('bafyxyz');
    expect(result).toBeNull();
  });
});
