import { Hono } from 'hono';

export const health = new Hono();

health.get('/', async (c) => {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Matches what /ipfs/upload actually requires: it signs with the key pair, never a JWT.
  if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY) {
    checks.pinata = 'configured';
  } else {
    checks.pinata = 'missing';
    healthy = false;
  }

  return c.json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    version: '0.1.0',
  });
});
