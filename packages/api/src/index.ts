import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { installFileFetchShim } from './lib/fileFetchShim.js';
import { logError } from './lib/logError.js';
import { ConfigError } from './lib/relayErrors.js';
import { apiKeyGate } from './middleware/apiKey.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { activities } from './routes/activities.js';
import { agent } from './routes/agent.js';
import { arkiv } from './routes/arkiv.js';
import { health } from './routes/health.js';
import { humanPass } from './routes/humanPass.js';
import { ipfs } from './routes/ipfs.js';
import { maintenance } from './routes/maintenance.js';
import { push } from './routes/push.js';
import { relay } from './routes/relay.js';
import { social } from './routes/social.js';
import { live } from './routes/live.js';
import { uniswap } from './routes/uniswap.js';
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
    allowHeaders: ['Content-Type', 'X-API-Key', 'Authorization', 'X-Admin-Key', 'X-Approval-Secret'],
    exposeHeaders: ['WWW-Authenticate'],
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

// The mock World approval page is opened in a phone browser, which can't send
// the API key; it only exists when WORLD_OIDC_MOCK is on outside production.
const isMockApprovalPage = (c: Context) => c.req.path.startsWith('/api/human/mock/');
app.use('/human/*', limit(60));
app.use('/human/*', async (c, next) => (isMockApprovalPage(c) ? next() : apiKeyGate(c, next)));
// /agent/* authenticates with per-agent bearer tokens instead of the app key.
app.use('/agent/*', limit(60));
app.use('/arkiv/*', limit(60));
app.use('/arkiv/*', apiKeyGate);
app.use('/live/*', limit(60));
app.use('/uniswap/*', limit(30));
app.use('/uniswap/*', apiKeyGate);

app.route('/health', health);
app.route('/activities', activities);
app.route('/ipfs', ipfs);
app.route('/social', social);
app.route('/push', push);
app.route('/world', world);
app.route('/relay', relay);
app.route('/maintenance', maintenance);
app.route('/human', humanPass);
app.route('/agent', agent);
app.route('/arkiv', arkiv);
app.route('/uniswap', uniswap);
app.route('/live', live);

export default app;
