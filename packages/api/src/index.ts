import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { installFileFetchShim } from './lib/fileFetchShim.js';
import { logError } from './lib/logError.js';
import { ConfigError } from './lib/relayErrors.js';
import { apiKeyGate } from './middleware/apiKey.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { account } from './routes/account.js';
import { activities } from './routes/activities.js';
import { agent } from './routes/agent.js';
import { arkiv } from './routes/arkiv.js';
import { clubs } from './routes/clubs.js';
import { health } from './routes/health.js';
import { humanPass } from './routes/humanPass.js';
import { indexRoutes } from './routes/indexRoutes.js';
import { ipfs } from './routes/ipfs.js';
import { live } from './routes/live.js';
import { maintenance } from './routes/maintenance.js';
import { push } from './routes/push.js';
import { relay } from './routes/relay.js';
import { social } from './routes/social.js';
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
  // A dependency (Arkiv, Pinata, an RPC) that did not answer in time is not a bug in this request:
  // 503 tells the client it can retry, where a 500 looked like a permanent failure.
  if (err instanceof Error && err.name === 'TimeoutError') {
    return c.json({ error: 'Upstream service timed out' }, 503);
  }
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
    allowHeaders: [
      'Content-Type',
      'X-API-Key',
      'Authorization',
      'X-Admin-Key',
      'X-Approval-Secret',
    ],
    exposeHeaders: ['WWW-Authenticate'],
    credentials: true,
  })
);

// Each group has its own request budget per minute: a shared one would let a burst of IPFS uploads
// and mints starve World ID polling (and the reverse). `gated` groups also need the app's API key;
// the two that are not guard themselves (relay with its own gate, maintenance with a cron bearer).
const ROUTE_GROUPS = [
  { path: '/ipfs', limit: 30, gated: true },
  { path: '/activities', limit: 30, gated: true },
  { path: '/social', limit: 30, gated: true },
  { path: '/clubs', limit: 30, gated: true },
  { path: '/index', limit: 60, gated: true },
  { path: '/push', limit: 30, gated: true },
  // Deleting an account is rare and removes records one by one, so the budget is small.
  { path: '/account', limit: 5, gated: true },
  // A verification polls every 2s for up to 3 minutes, so it needs well over 30 a minute.
  { path: '/world', limit: 120, gated: true },
  { path: '/arkiv', limit: 60, gated: true },
  { path: '/uniswap', limit: 30, gated: true },
  { path: '/relay', limit: 30, gated: false },
  { path: '/maintenance', limit: 5, gated: false },
  // Their own credentials: /human gates itself below (the mock approval page cannot send the key),
  // /agent uses per-agent bearer tokens, /live is a public follow-along page.
  { path: '/human', limit: 60, gated: false },
  { path: '/agent', limit: 60, gated: false },
  { path: '/live', limit: 60, gated: false },
] as const;

for (const { path, limit, gated } of ROUTE_GROUPS) {
  app.use(`${path}/*`, createRateLimiter({ windowMs: 60_000, max: limit, maxKeys: 5_000 }));
  if (gated) app.use(`${path}/*`, apiKeyGate);
}

// The mock World approval page is opened in a phone browser, which can't send
// the API key; it only exists when WORLD_OIDC_MOCK is on outside production.
const isMockApprovalPage = (c: Context) => c.req.path.startsWith('/api/human/mock/');
app.use('/human/*', async (c, next) => (isMockApprovalPage(c) ? next() : apiKeyGate(c, next)));

app.route('/health', health);
app.route('/activities', activities);
app.route('/ipfs', ipfs);
app.route('/social', social);
app.route('/index', indexRoutes);
app.route('/clubs', clubs);
app.route('/push', push);
app.route('/account', account);
app.route('/world', world);
app.route('/relay', relay);
app.route('/maintenance', maintenance);
app.route('/human', humanPass);
app.route('/agent', agent);
app.route('/arkiv', arkiv);
app.route('/uniswap', uniswap);
app.route('/live', live);

export default app;
