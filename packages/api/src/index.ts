import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { installFileFetchShim } from './lib/fileFetchShim.js';
import { logError } from './lib/logError.js';
import { ConfigError } from './lib/relayErrors.js';
import { apiKeyGate } from './middleware/apiKey.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { activities } from './routes/activities.js';
import { health } from './routes/health.js';
import { ipfs } from './routes/ipfs.js';
import { maintenance } from './routes/maintenance.js';
import { push } from './routes/push.js';
import { relay } from './routes/relay.js';
import { social } from './routes/social.js';
import { world } from './routes/world.js';

// @worldcoin/idkit-core loads its wasm via fetch(file://...) which Node's
// undici rejects — patch fetch first so IDKit can initialise lazily on the
// first /world/session call.
installFileFetchShim();

const app = new Hono().basePath('/api');

// Anything a route did not map ends here: JSON with a stable shape, details only in the logs.
app.onError((err, c) => {
  logError('[error]', err);
  if (err instanceof ConfigError) return c.json({ error: 'Service misconfigured' }, 503);
  return c.json({ error: 'Internal server error' }, 500);
});

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
    allowHeaders: ['Content-Type', 'X-API-Key'],
    credentials: true,
  })
);

// One budget per route group: a shared one would let a burst of IPFS uploads and mints
// starve World ID polling (and the reverse).
const limit = (max: number) => createRateLimiter({ windowMs: 60_000, max, maxKeys: 5_000 });

app.use('/ipfs/*', limit(30));
app.use('/activities/*', limit(30));
app.use('/relay/*', limit(30));
app.use('/social/*', limit(30));
app.use('/push/*', limit(30));
app.use('/maintenance/*', limit(5));
// A verification polls every 2s for up to 3 minutes, so it needs well over 30 a minute.
app.use('/world/*', limit(120));

app.use('/ipfs/*', apiKeyGate);
app.use('/activities/*', apiKeyGate);
app.use('/social/*', apiKeyGate);
app.use('/push/*', apiKeyGate);

app.use('/world/*', apiKeyGate);

app.route('/health', health);
app.route('/activities', activities);
app.route('/ipfs', ipfs);
app.route('/social', social);
app.route('/push', push);
app.route('/world', world);
app.route('/relay', relay);
app.route('/maintenance', maintenance);

export default app;
