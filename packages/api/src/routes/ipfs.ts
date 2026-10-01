import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { logError } from '../lib/logError.js';

interface PinResult {
  IpfsHash: string;
  PinSize: number;
}

function isPinResult(value: unknown): value is PinResult {
  if (typeof value !== 'object' || value === null) return false;
  const { IpfsHash, PinSize } = value as Record<string, unknown>;
  return typeof IpfsHash === 'string' && IpfsHash.length > 0 && typeof PinSize === 'number';
}

export const ipfs = new Hono();

const MAX_BASE64_LENGTH = 14_000_000; // ~10MB decoded
const MAX_REQUEST_BYTES = MAX_BASE64_LENGTH + 100_000;
const MAX_JSON_BYTES = 256 * 1024;
const PINATA_TIMEOUT_MS = 30_000;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

// Identify the image from its leading bytes rather than trusting the client's mimeType.
function detectImageType(bytes: Buffer): { type: string; ext: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { type: 'image/jpeg', ext: 'jpg' };
  }
  if (bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return { type: 'image/png', ext: 'png' };
  }
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return { type: 'image/webp', ext: 'webp' };
  }
  return null;
}

ipfs.post(
  '/upload',
  bodyLimit({
    maxSize: MAX_REQUEST_BYTES,
    onError: (c) => c.json({ error: 'Payload too large' }, 413),
  }),
  async (c) => {
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecretKey = process.env.PINATA_SECRET_KEY;

    if (!pinataApiKey || !pinataSecretKey) {
      return c.json({ error: 'IPFS pinning not configured' }, 503);
    }

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const { name, content, imageBase64 } = body;

    // Used as the upload filename and Pinata label: letters, digits, dash, underscore only.
    const safeName =
      (typeof name === 'string' ? name.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) : '') ||
      `stryde-${Date.now()}`;

    const formData = new FormData();

    if (imageBase64) {
      if (typeof imageBase64 !== 'string' || imageBase64.length > MAX_BASE64_LENGTH) {
        return c.json({ error: 'Image payload too large (max 10MB)' }, 413);
      }
      if (!BASE64_PATTERN.test(imageBase64)) {
        return c.json({ error: 'Invalid base64 image' }, 400);
      }
      const bytes = Buffer.from(imageBase64, 'base64');
      const image = detectImageType(bytes);
      if (!image) {
        return c.json({ error: 'Unsupported image type' }, 400);
      }
      const blob = new Blob([bytes], { type: image.type });
      formData.append('file', blob, `${safeName}.${image.ext}`);
    } else if (content) {
      const json = JSON.stringify(content);
      if (Buffer.byteLength(json) > MAX_JSON_BYTES) {
        return c.json({ error: 'Document too large (max 256KB)' }, 413);
      }
      const blob = new Blob([json], { type: 'application/json' });
      formData.append('file', blob, `${safeName}.json`);
    } else {
      return c.json({ error: 'Content or imageBase64 is required' }, 400);
    }

    formData.append('pinataMetadata', JSON.stringify({ name: safeName }));

    let response: Response;
    try {
      response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          pinata_api_key: pinataApiKey,
          pinata_secret_api_key: pinataSecretKey,
        },
        body: formData,
        signal: AbortSignal.timeout(PINATA_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      logError('[ipfs/upload] Pinata request failed:', error);
      return c.json({ error: 'Pinning service did not respond' }, timedOut ? 504 : 502);
    }

    if (!response.ok) {
      const error = await response.text();
      logError('[ipfs/upload] Pinata error:', error);
      return c.json({ error: 'Failed to pin content to IPFS' }, 502);
    }

    const result: unknown = await response.json();
    if (!isPinResult(result)) {
      console.error('[ipfs/upload] Unexpected Pinata response:', result);
      return c.json({ error: 'Failed to pin content to IPFS' }, 502);
    }

    return c.json({
      cid: result.IpfsHash,
      size: result.PinSize,
    });
  }
);
