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

// Fixed-window per-IP limiter for the IPFS routes — Pinata pins cost money and
// an API-key leak or bug elsewhere shouldn't turn into an unbounded pinning
// bill. In-memory only: fine for this single long-lived Node process, but
// won't share state across cold-started serverless instances if this ever
// runs on Vercel's Node runtime as multiple concurrent lambdas.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const requestCounts = new Map<string, { count: number; windowStart: number }>();

app.use('/ipfs/*', async (c, next) => {
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
});

// Lightweight shared-secret gate for write endpoints. Not a substitute for
// real per-user auth, but stops anonymous scraping/abuse of the IPFS pinning
// quota now that this API is publicly reachable. Skipped entirely if API_KEY
// isn't set (local dev) — but in production that's a misconfiguration, not a
// green light to run wide open, so fail closed there instead.
app.use('/ipfs/*', async (c, next) => {
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
});

app.route('/health', health);
app.route('/activities', activities);
app.route('/ipfs', ipfs);
app.route('/notifications', notifications);

export default app;
