import { afterEach, describe, expect, it } from 'vitest';
import type { RenewalClient } from '../../lib/arkivRenewal.js';
import { createMaintenanceRoutes } from '../maintenance.js';

const original = process.env.CRON_SECRET;
afterEach(() => {
  if (original === undefined) process.env.CRON_SECRET = undefined;
  else process.env.CRON_SECRET = original;
  if (original === undefined) delete process.env.CRON_SECRET;
});

const client: RenewalClient = {
  head: async () => 100n,
  expiring: async () => ({ entities: [], complete: true }),
  extend: async () => {},
};

describe('GET /renew-arkiv', () => {
  it('refuses when no secret is configured', async () => {
    delete process.env.CRON_SECRET;
    const res = await createMaintenanceRoutes(() => client).request('/renew-arkiv');
    expect(res.status).toBe(401);
  });

  it('refuses a wrong or missing bearer token', async () => {
    process.env.CRON_SECRET = 'right';
    const app = createMaintenanceRoutes(() => client);
    expect((await app.request('/renew-arkiv')).status).toBe(401);
    const wrong = await app.request('/renew-arkiv', { headers: { Authorization: 'Bearer nope' } });
    expect(wrong.status).toBe(401);
  });

  it('runs the renewal and returns the report', async () => {
    process.env.CRON_SECRET = 'right';
    const res = await createMaintenanceRoutes(() => client).request('/renew-arkiv', {
      headers: { Authorization: 'Bearer right' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ found: 0, renewed: 0, failed: 0, more: false });
  });
});
