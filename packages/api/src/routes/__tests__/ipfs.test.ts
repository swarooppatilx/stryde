import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipfs } from '../ipfs.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(16)]);

const post = (body: unknown) =>
  ipfs.request('/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /ipfs/upload', () => {
  const original = {
    key: process.env.PINATA_API_KEY,
    secret: process.env.PINATA_SECRET_KEY,
  };
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.PINATA_API_KEY = 'k';
    process.env.PINATA_SECRET_KEY = 's';
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ IpfsHash: 'bafy', PinSize: 3 }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.env.PINATA_API_KEY = original.key;
    process.env.PINATA_SECRET_KEY = original.secret;
  });

  it('pins a JSON document and returns its cid', async () => {
    const res = await post({ name: 'meta', content: { a: 1 } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cid: 'bafy', size: 3 });
  });

  it('pins a recognised image', async () => {
    const res = await post({ name: 'pic', imageBase64: PNG.toString('base64') });

    expect(res.status).toBe(200);
  });

  it('rejects an image whose bytes are not a supported type, whatever the client says', async () => {
    const res = await post({ imageBase64: Buffer.from('not an image').toString('base64') });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a request body over the size limit before parsing it', async () => {
    const res = await post({ imageBase64: 'A'.repeat(15_000_000) });

    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a JSON document over 256 KB', async () => {
    const res = await post({ content: { text: 'x'.repeat(300_000) } });

    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 503, not 500, when pinning is not configured', async () => {
    delete process.env.PINATA_API_KEY;

    const res = await post({ content: { a: 1 } });

    expect(res.status).toBe(503);
  });

  it('answers 504 when Pinata does not respond in time', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));

    const res = await post({ content: { a: 1 } });

    expect(res.status).toBe(504);
  });

  it('answers 502 when Pinata refuses the pin', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));

    const res = await post({ content: { a: 1 } });

    expect(res.status).toBe(502);
  });
});
