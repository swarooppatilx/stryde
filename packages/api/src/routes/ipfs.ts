import { Hono } from 'hono';

export const ipfs = new Hono();

const MAX_BASE64_LENGTH = 14_000_000; // ~10MB decoded
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

ipfs.post('/upload', async (c) => {
  const pinataApiKey = process.env.PINATA_API_KEY;
  const pinataSecretKey = process.env.PINATA_SECRET_KEY;

  if (!pinataApiKey || !pinataSecretKey) {
    return c.json({ error: 'IPFS pinning not configured' }, 500);
  }

  const body = await c.req.json();
  const { name, content, imageBase64, mimeType } = body;

  const formData = new FormData();

  if (imageBase64) {
    if (typeof imageBase64 !== 'string' || imageBase64.length > MAX_BASE64_LENGTH) {
      return c.json({ error: 'Image payload too large (max 10MB)' }, 413);
    }
    if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
      return c.json({ error: 'Unsupported image type' }, 400);
    }
    const bytes = Buffer.from(imageBase64, 'base64');
    const ext = mimeType?.includes('png') ? 'png' : mimeType?.includes('webp') ? 'webp' : 'jpg';
    const blob = new Blob([bytes], { type: mimeType || 'image/jpeg' });
    formData.append('file', blob, `${name || `stryde-${Date.now()}`}.${ext}`);
  } else if (content) {
    const blob = new Blob([JSON.stringify(content)], { type: 'application/json' });
    formData.append('file', blob, `${name || `stryde-${Date.now()}`}.json`);
  } else {
    return c.json({ error: 'Content or imageBase64 is required' }, 400);
  }

  formData.append('pinataMetadata', JSON.stringify({ name: name || `stryde-${Date.now()}` }));

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataSecretKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[ipfs/upload] Pinata error:', error);
    return c.json({ error: 'Failed to pin content to IPFS' }, 502);
  }

  const result = await response.json();

  return c.json({
    cid: result.IpfsHash,
    size: result.PinSize,
  });
});
