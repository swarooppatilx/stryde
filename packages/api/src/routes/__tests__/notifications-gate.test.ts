import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../index.js';

describe('apiKeyGate on /notifications/*', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.API_KEY;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.API_KEY = originalApiKey;
  });

  it('rejects requests with no API key', async () => {
    const res = await app.request('/api/notifications/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'ExponentPushToken[whatever]' }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  it('rejects requests with the wrong API key', async () => {
    const res = await app.request('/api/notifications/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'wrong-key' },
      body: JSON.stringify({ to: 'ExponentPushToken[whatever]' }),
    });

    expect(res.status).toBe(401);
  });

  it('is fail-closed in production when API_KEY itself is unset', async () => {
    process.env.API_KEY = '';

    const res = await app.request('/api/notifications/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'ExponentPushToken[whatever]' }),
    });

    expect(res.status).toBe(503);
  });
});
