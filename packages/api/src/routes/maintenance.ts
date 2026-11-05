import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import {
  arkivConfigFromEnv,
  arkivSignerFromEnv,
  createArkivPublicClient,
  createArkivWalletClient,
} from '../lib/arkiv.js';
import {
  createArkivRenewalClient,
  type RenewalClient,
  renewExpiring,
} from '../lib/arkivRenewal.js';
import { isProduction } from '../lib/env.js';
import { ConfigError } from '../lib/relayErrors.js';

function bearerMatches(header: string | undefined, secret: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function buildRenewalClient(): RenewalClient {
  const config = arkivConfigFromEnv();
  return createArkivRenewalClient(
    createArkivPublicClient(config),
    createArkivWalletClient(arkivSignerFromEnv(), config)
  );
}

/**
 * Scheduled upkeep. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`; the route is
 * closed when the secret is unset, so it can never be hit anonymously.
 */
export function createMaintenanceRoutes(getClient: () => RenewalClient = buildRenewalClient) {
  const maintenance = new Hono();

  maintenance.get('/renew-arkiv', async (c) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      if (isProduction()) return c.json({ error: 'Service misconfigured' }, 503);
      return c.json({ error: 'Unauthorized' }, 401);
    }
    if (!bearerMatches(c.req.header('Authorization'), secret)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    try {
      return c.json(await renewExpiring(getClient()));
    } catch (error) {
      if (error instanceof ConfigError) return c.json({ error: 'Service misconfigured' }, 503);
      throw error;
    }
  });

  return maintenance;
}

export const maintenance = createMaintenanceRoutes();
