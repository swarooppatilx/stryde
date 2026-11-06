import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { IntentError, respondIntent } from '../intentError.js';

const app = (run: () => Promise<unknown>) => {
  const a = new Hono();
  a.get('/x', (c) => respondIntent(c, run));
  return a;
};

describe('respondIntent', () => {
  it('sends the service result as JSON when it works', async () => {
    const res = await app(async () => ({ ok: true })).request('/x');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('maps an IntentError to its status, message and code', async () => {
    const res = await app(async () => {
      throw new IntentError('bad_signature', 'Signature does not match');
    }).request('/x');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Signature does not match', code: 'bad_signature' });
  });

  it('lets any other error through to the app-wide handler', async () => {
    const a = new Hono();
    a.onError((_e, c) => c.json({ error: 'boom' }, 500));
    a.get('/x', (c) =>
      respondIntent(c, async () => {
        throw new Error('db down');
      })
    );
    const res = await a.request('/x');
    expect(res.status).toBe(500);
  });
});
