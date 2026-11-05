import { afterEach, describe, expect, it } from 'vitest';
import { health } from '../health.js';

const KEYS = ['PINATA_API_KEY', 'PINATA_SECRET_KEY', 'PINATA_JWT', 'PINATA_GATEWAY_URL'] as const;
const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function setEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, values);
}

async function check() {
  const res = await health.request('/');
  return (await res.json()) as { status: string; checks: { pinata: string } };
}

describe('GET /health', () => {
  afterEach(() => {
    for (const k of KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it('is ok when the Pinata key pair the upload route uses is set', async () => {
    setEnv({ PINATA_API_KEY: 'k', PINATA_SECRET_KEY: 's' });

    expect(await check()).toMatchObject({ status: 'ok', checks: { pinata: 'configured' } });
  });

  it('is degraded when nothing is set', async () => {
    setEnv({});

    expect(await check()).toMatchObject({ status: 'degraded', checks: { pinata: 'missing' } });
  });

  it('does not call a JWT enough, because uploads cannot use it and would answer 503', async () => {
    setEnv({ PINATA_JWT: 'jwt', PINATA_GATEWAY_URL: 'https://gw.example' });

    expect(await check()).toMatchObject({ status: 'degraded', checks: { pinata: 'missing' } });
  });

  it('is degraded with only half of the key pair', async () => {
    setEnv({ PINATA_API_KEY: 'k' });

    expect((await check()).status).toBe('degraded');
  });
});
