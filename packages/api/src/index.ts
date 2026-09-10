import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { activities } from './routes/activities.js';
import { health } from './routes/health.js';
import { ipfs } from './routes/ipfs.js';
import { notifications } from './routes/notifications.js';
import { relay } from './routes/relay.js';
import { world } from './routes/world.js';

const app = new Hono().basePath('/api');

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin: string) => origin.trim())
  .filter(Boolean);

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: allowedOrigins,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'X-API-Key', 'X-Request-ID'],
    credentials: true,
  })
);

// Fixed-window per-IP limiter for the IPFS and activity-validation routes —
// Pinata pins cost money, and /activities/validate does real hashing work per
// call, so an API-key leak or bug elsewhere shouldn't turn into an unbounded
// bill/CPU-abuse vector on either. In-memory only: fine for this single
// long-lived Node process, but won't share state across cold-started
// serverless instances if this ever runs on Vercel's Node runtime as
// multiple concurrent lambdas.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const requestCounts = new Map<string, RateLimitEntry>();

const rateLimiter = async (c: Context, next: Next) => {
  const key =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (entry && now > entry.resetTime) {
    requestCounts.delete(key);
  }

  const current = requestCounts.get(key);
  if (!current) {
    requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
  } else {
    current.count += 1;
    if (current.count > RATE_LIMIT_MAX_REQUESTS) {
      return c.json({ error: 'Too many requests' }, 429);
    }
  }

  if (requestCounts.size > 10000) {
    requestCounts.clear();
  }

  await next();
};

app.use('/ipfs/*', rateLimiter);
app.use('/activities/*', rateLimiter);
app.use('/relay/*', rateLimiter);

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
// abuse as the IPFS pinning routes, so it gets the same gate. /notifications/*
// sends real push notifications through Expo's API, so an anonymous caller
// shouldn't be able to spam arbitrary device tokens either.
app.use('/ipfs/*', apiKeyGate);
app.use('/activities/*', apiKeyGate);
app.use('/relay/*', apiKeyGate);
app.use('/notifications/*', apiKeyGate);

app.use('/world/*', rateLimiter);
app.use('/world/*', apiKeyGate);

app.route('/health', health);
app.route('/activities', activities);
app.route('/ipfs', ipfs);
app.route('/notifications', notifications);
app.route('/world', world);
app.route('/relay', relay);

export default app;
