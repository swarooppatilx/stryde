import { Hono } from 'hono';

export const ipfs = new Hono();

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
    const binaryStr = atob(imageBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const ext = mimeType?.includes('png') ? 'png' : 'jpg';
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
    return c.json({ error: `Pinata error: ${error}` }, 500);
  }

  const result = await response.json();

  return c.json({
    cid: result.IpfsHash,
    size: result.PinSize,
  });
});
