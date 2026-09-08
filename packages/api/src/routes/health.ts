import { Hono } from 'hono';

export const health = new Hono();

health.get('/', async (c) => {
  const checks: Record<string, string> = {};
  let healthy = true;

  const hasPinataKeys = !!(process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY);
  const hasPinataJwt = !!(process.env.PINATA_JWT && process.env.PINATA_GATEWAY_URL);
  if (hasPinataKeys) {
    checks.pinata = 'configured';
  } else if (hasPinataJwt) {
    checks.pinata = 'configured (jwt)';
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
