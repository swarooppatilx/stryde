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

describe('POST /index', () => {
  const run = async () => ({ from: 10n, to: 99n, written: 4, reorged: false });

  it('refuses without the bearer secret, like the renewal route', async () => {
    process.env.CRON_SECRET = 'right';
    const app = createMaintenanceRoutes(() => client, run);

    expect((await app.request('/index', { method: 'POST' })).status).toBe(401);
    const wrong = await app.request('/index', {
      method: 'POST',
      headers: { Authorization: 'Bearer nope' },
    });
    expect(wrong.status).toBe(401);
  });

  it('is closed when no secret is configured', async () => {
    delete process.env.CRON_SECRET;
    const app = createMaintenanceRoutes(() => client, run);

    expect((await app.request('/index', { method: 'POST' })).status).toBe(401);
  });

  it('runs a sync now and answers with what it did, block numbers as text', async () => {
    process.env.CRON_SECRET = 'right';
    const app = createMaintenanceRoutes(() => client, run);

    const res = await app.request('/index', {
      method: 'POST',
      headers: { Authorization: 'Bearer right' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ from: '10', to: '99', written: 4, reorged: false });
  });
});

describe('POST /notify-events', () => {
  const report = {
    from: '1',
    to: '2',
    windows: 1,
    events: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    incomplete: false,
  };
  const build = (run = async () => report) => createMaintenanceRoutes(() => client, undefined, run);

  it('refuses without the bearer secret and when none is configured', async () => {
    process.env.CRON_SECRET = 'right';
    expect((await build().request('/notify-events', { method: 'POST' })).status).toBe(401);
    const wrong = await build().request('/notify-events', {
      method: 'POST',
      headers: { Authorization: 'Bearer nope' },
    });
    expect(wrong.status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await build().request('/notify-events', { method: 'POST' })).status).toBe(401);
  });

  it('runs the notifier and returns its report', async () => {
    process.env.CRON_SECRET = 'right';
    const res = await build().request('/notify-events', {
      method: 'POST',
      headers: { Authorization: 'Bearer right' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(report);
  });

  it('also answers the GET that Vercel Cron sends', async () => {
    process.env.CRON_SECRET = 'right';
    const res = await build().request('/notify-events', {
      headers: { Authorization: 'Bearer right' },
    });
    expect(res.status).toBe(200);
  });
});
