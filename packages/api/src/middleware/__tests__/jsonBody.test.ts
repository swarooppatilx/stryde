import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { invalidJsonBody, limitBody, readJsonObject } from '../jsonBody.js';

function app() {
  const a = new Hono();
  a.post('/echo', limitBody(32), async (c) => {
    const body = await readJsonObject(c);
    if (!body) return invalidJsonBody(c);
    return c.json({ got: body });
  });
  return a;
}

const post = (body: string) =>
  app().request('/echo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': String(body.length) },
    body,
  });

describe('limitBody', () => {
  it('lets a small body through', async () => {
    const res = await post('{"a":1}');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ got: { a: 1 } });
  });

  it('answers 413 "Payload too large" for a body over the limit', async () => {
    const res = await post(JSON.stringify({ text: 'x'.repeat(100) }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Payload too large' });
  });
});

describe('readJsonObject and invalidJsonBody', () => {
  it('answers 400 "Invalid JSON body" for text that is not JSON', async () => {
    const res = await post('not json');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
  });

  it('treats JSON that is not an object (null, a number, a string) as invalid', async () => {
    for (const body of ['null', '12', '"hi"']) {
      expect((await post(body)).status).toBe(400);
    }
  });
});
