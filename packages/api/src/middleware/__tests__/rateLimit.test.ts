import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { clientKey, createRateLimiter } from '../rateLimit.js';

function appWith(
  options: { max: number; windowMs?: number; maxKeys?: number },
  clock = { now: 0 }
) {
  const app = new Hono();
  app.use(
    '*',
    createRateLimiter({ windowMs: 1000, maxKeys: 100, ...options, now: () => clock.now })
  );
  app.get('/', (c) => c.text('ok'));
  const call = (headers: Record<string, string> = {}) => app.request('/', { headers });
  return { call, clock };
}

describe('createRateLimiter', () => {
  it('allows up to the limit, then answers 429', async () => {
    const { call } = appWith({ max: 2 });

    expect((await call({ 'x-real-ip': '1.1.1.1' })).status).toBe(200);
    expect((await call({ 'x-real-ip': '1.1.1.1' })).status).toBe(200);
    expect((await call({ 'x-real-ip': '1.1.1.1' })).status).toBe(429);
  });

  it('counts each client separately', async () => {
    const { call } = appWith({ max: 1 });

    expect((await call({ 'x-real-ip': '1.1.1.1' })).status).toBe(200);
    expect((await call({ 'x-real-ip': '2.2.2.2' })).status).toBe(200);
  });

  it('starts a new window once the old one has passed', async () => {
    const { call, clock } = appWith({ max: 1, windowMs: 1000 });
    await call({ 'x-real-ip': '1.1.1.1' });
    expect((await call({ 'x-real-ip': '1.1.1.1' })).status).toBe(429);

    clock.now = 1001;

    expect((await call({ 'x-real-ip': '1.1.1.1' })).status).toBe(200);
  });

  it('tells the client when to come back', async () => {
    const { call } = appWith({ max: 1, windowMs: 5000 });
    await call({ 'x-real-ip': '1.1.1.1' });

    const res = await call({ 'x-real-ip': '1.1.1.1' });

    expect(res.headers.get('retry-after')).toBe('5');
  });

  it('cannot be dodged by sending a fake x-forwarded-for', async () => {
    const { call } = appWith({ max: 1 });
    await call({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.1' });

    const res = await call({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.2' });

    expect(res.status).toBe(429);
  });

  it('keeps limiting everyone else when the table is full: only the oldest clients are forgotten', async () => {
    const { call } = appWith({ max: 1, maxKeys: 2 });
    await call({ 'x-real-ip': 'a' });
    await call({ 'x-real-ip': 'b' });
    await call({ 'x-real-ip': 'c' });

    expect((await call({ 'x-real-ip': 'c' })).status).toBe(429);
    expect((await call({ 'x-real-ip': 'b' })).status).toBe(429);
    expect((await call({ 'x-real-ip': 'a' })).status).toBe(200);
  });
});

describe('clientKey', () => {
  const header = (values: Record<string, string>) => (name: string) => values[name];

  it('prefers the platform-set header', () => {
    expect(clientKey(header({ 'x-vercel-forwarded-for': '3.3.3.3', 'x-real-ip': '4.4.4.4' }))).toBe(
      '3.3.3.3'
    );
  });

  it('falls back to x-real-ip, then the socket address, then one shared bucket', () => {
    expect(clientKey(header({ 'x-real-ip': '4.4.4.4' }), '5.5.5.5')).toBe('4.4.4.4');
    expect(clientKey(header({}), '5.5.5.5')).toBe('5.5.5.5');
    expect(clientKey(header({}))).toBe('unknown');
  });
});
