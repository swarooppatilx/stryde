import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';

/** Refuses a request body over `maxSize` bytes with the same 413 every route answers. */
export const limitBody = (maxSize: number) =>
  bodyLimit({ maxSize, onError: (c) => c.json({ error: 'Payload too large' }, 413) });

/** The request's JSON body when it is an object; null when it is not JSON or is a bare value like `null` or `12`. */
export async function readJsonObject(c: Context): Promise<Record<string, unknown> | null> {
  const body = await c.req.json().catch(() => null);
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
}

/** The 400 for a body `readJsonObject` could not use. */
export const invalidJsonBody = (c: Context) => c.json({ error: 'Invalid JSON body' }, 400);
