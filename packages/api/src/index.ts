import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { activities } from './routes/activities.js';
import { health } from './routes/health.js';
import { ipfs } from './routes/ipfs.js';
import { notifications } from './routes/notifications.js';

const app = new Hono().basePath('/api');

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin: string) => origin.trim())
  .filter(Boolean);

app.use('*', logger());
app.use('*', cors({ origin: allowedOrigins }));

// Fixed-window per-IP limiter for the IPFS and activity-validation routes —
// Pinata pins cost money, and /activities/validate does real hashing work per
// call, so an API-key leak or bug elsewhere shouldn't turn into an unbounded
// bill/CPU-abuse vector on either. In-memory only: fine for this single
// long-lived Node process, but won't share state across cold-started
// serverless instances if this ever runs on Vercel's Node runtime as
// multiple concurrent lambdas.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const requestCounts = new Map<string, { count: number; windowStart: number }>();

const rateLimiter = async (c: Context, next: Next) => {
  const key = c.req.header('X-Forwarded-For') || 'unknown';
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(key, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
    if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
      return c.json({ error: 'Too many requests' }, 429);
    }
  }
  await next();
};

app.use('/ipfs/*', rateLimiter);
app.use('/activities/*', rateLimiter);

// Lightweight shared-secret gate for write endpoints. Not a substitute for
// real per-user auth, but stops anonymous scraping/abuse of the IPFS pinning
// quota and of the activity-validation oracle now that this API is publicly
// reachable. Skipped entirely if API_KEY isn't set (local dev) — but in
// production that's a misconfiguration, not a green light to run wide open,
// so fail closed there instead.
const apiKeyGate = async (c: Context, next: Next) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      return c.json({ error: 'Service misconfigured' }, 503);
    }
    await next();
    return;
  }
  if (c.req.header('X-API-Key') !== apiKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};

// /activities/validate is the trusted oracle endpoint the client relies on
// before recording an activity on-chain — at least as high-value a target for
// abuse as the IPFS pinning routes, so it gets the same gate.
app.use('/ipfs/*', apiKeyGate);
app.use('/activities/*', apiKeyGate);

app.route('/health', health);
app.route('/activities', activities);
app.route('/ipfs', ipfs);
app.route('/notifications', notifications);

export default app;
