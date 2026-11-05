import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Most clients remembered at once; the oldest are forgotten first. */
  maxKeys: number;
  now?: () => number;
}

/**
 * Only headers the hosting platform sets itself: a client-supplied x-forwarded-for can be anything.
 * Without them (outside Vercel) the socket address keeps clients apart instead of one shared bucket.
 */
export function clientKey(
  header: (name: string) => string | undefined,
  remoteAddress?: string
): string {
  return header('x-vercel-forwarded-for') || header('x-real-ip') || remoteAddress || 'unknown';
}

/** The peer address on @hono/node-server; other runtimes have no `incoming` socket. */
function socketAddress(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address;
  } catch {
    return undefined;
  }
}

/**
 * Fixed-window limiter held in this process's memory, so each serverless instance
 * counts separately: it bounds abuse per instance, not globally.
 */
export function createRateLimiter(options: RateLimitOptions): MiddlewareHandler {
  const { windowMs, max, maxKeys, now = Date.now } = options;
  const windows = new Map<string, Window>();

  const makeRoom = (time: number) => {
    for (const [key, w] of windows) if (time > w.resetAt) windows.delete(key);
    while (windows.size >= maxKeys) {
      const oldest = windows.keys().next().value;
      if (oldest === undefined) break;
      windows.delete(oldest);
    }
  };

  return async (c: Context, next) => {
    const time = now();
    const key = clientKey((name) => c.req.header(name), socketAddress(c));
    let current = windows.get(key);

    if (current && time > current.resetAt) {
      windows.delete(key);
      current = undefined;
    }
    if (!current) {
      if (windows.size >= maxKeys) makeRoom(time);
      current = { count: 0, resetAt: time + windowMs };
      windows.set(key, current);
    }

    current.count += 1;
    if (current.count > max) {
      c.header('Retry-After', String(Math.ceil((current.resetAt - time) / 1000)));
      return c.json({ error: 'Too many requests' }, 429);
    }
    await next();
  };
}
