import { timingSafeEqual } from 'node:crypto';
import type { Context, Next } from 'hono';
import { isProduction } from '../lib/env.js';

function sameKey(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Shared-secret gate. Open when API_KEY is unset in development, closed (503) in production. */
export async function apiKeyGate(c: Context, next: Next) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    if (isProduction()) return c.json({ error: 'Service misconfigured' }, 503);
    await next();
    return;
  }
  if (!sameKey(c.req.header('X-API-Key'), apiKey)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
}
