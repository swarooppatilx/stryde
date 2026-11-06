import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Full GPX tracks live on Swarm; Arkiv entities only hold the reference.
 * Private routes are uploaded with Bee's built-in encryption — that reference
 * embeds its decryption key, and Arkiv entities are public, so the reference
 * itself is sealed with AES-256-GCM under a per-athlete key before it is
 * written to Arkiv (stored as `enc:v1:...`).
 */

const ENC_PREFIX = 'enc:v1:';

export function isSwarmConfigured(): boolean {
  return Boolean(process.env.SWARM_BEE_URL && process.env.SWARM_POSTAGE_BATCH_ID);
}

function beeUrl(): string {
  const url = process.env.SWARM_BEE_URL;
  if (!url) throw new Error('[swarm] Missing env var: SWARM_BEE_URL');
  return url.replace(/\/$/, '');
}

export function swarmGatewayLink(reference: string): string {
  const gateway = (process.env.SWARM_GATEWAY_URL || 'https://api.gateway.ethswarm.org').replace(
    /\/$/,
    ''
  );
  return `${gateway}/bytes/${reference}`;
}

export async function uploadToSwarm(
  content: string,
  options: { encrypt: boolean; contentType?: string }
): Promise<string> {
  const batchId = process.env.SWARM_POSTAGE_BATCH_ID;
  if (!batchId) throw new Error('[swarm] Missing env var: SWARM_POSTAGE_BATCH_ID');

  const response = await fetch(`${beeUrl()}/bytes`, {
    method: 'POST',
    headers: {
      'content-type': options.contentType ?? 'application/gpx+xml',
      'swarm-postage-batch-id': batchId,
      ...(options.encrypt ? { 'swarm-encrypt': 'true' } : {}),
    },
    body: content,
  });
  const body = (await response.json().catch(() => ({}))) as {
    reference?: string;
    message?: string;
  };
  if (!response.ok || !body.reference) {
    throw new Error(
      `[swarm] Upload failed (${response.status}): ${body.message ?? 'no reference'}`
    );
  }
  return body.reference;
}

export async function downloadFromSwarm(reference: string): Promise<string> {
  const response = await fetch(`${beeUrl()}/bytes/${reference}`);
  if (!response.ok) throw new Error(`[swarm] Download failed (${response.status})`);
  return response.text();
}

function athleteKey(athlete: string): Buffer {
  const secret = process.env.SWARM_REF_SECRET;
  if (!secret) throw new Error('[swarm] Missing env var: SWARM_REF_SECRET');
  return Buffer.from(hkdfSync('sha256', secret, athlete.toLowerCase(), 'stryde-swarm-ref', 32));
}

export function sealReference(reference: string, athlete: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', athleteKey(athlete), iv);
  const ciphertext = Buffer.concat([cipher.update(reference, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${tag.toString('base64url')}`;
}

export function openReference(sealed: string, athlete: string): string {
  if (!sealed.startsWith(ENC_PREFIX)) return sealed;
  const [iv, ciphertext, tag] = sealed.slice(ENC_PREFIX.length).split('.');
  if (!iv || !ciphertext || !tag) throw new Error('[swarm] Malformed sealed reference');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    athleteKey(athlete),
    Buffer.from(iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function isSealedReference(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}
