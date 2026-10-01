import { describe, expect, it, vi } from 'vitest';
import { ConfigError } from '../../lib/relayErrors.js';

vi.mock('../../routes/health.js', async () => {
  const { Hono } = await import('hono');
  const health = new Hono();
  health.get('/config', () => {
    throw new ConfigError('RELAYER_PRIVATE_KEY');
  });
  health.get('/boom', () => {
    throw new Error('secret detail');
  });
  return { health };
});

const { default: app } = await import('../../index.js');

describe('global error boundary', () => {
  it('answers 503 for missing configuration without naming the setting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await app.request('/api/health/config');

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Service misconfigured' });
  });

  it('answers 500 for anything else and never leaks the message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await app.request('/api/health/boom');

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret detail');
  });
});
