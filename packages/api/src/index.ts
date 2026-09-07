import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { activities } from './routes/activities';
import { health } from './routes/health';
import { ipfs } from './routes/ipfs';
import { notifications } from './routes/notifications';

const app = new Hono().basePath('/api');

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use('*', logger());
app.use('*', cors({ origin: allowedOrigins }));

// Lightweight shared-secret gate for write endpoints. Not a substitute for
// real per-user auth, but stops anonymous scraping/abuse of the IPFS pinning
// quota now that this API is publicly reachable. Skipped entirely if API_KEY
// isn't set (local dev).
app.use('/ipfs/*', async (c, next) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
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
