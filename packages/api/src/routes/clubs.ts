import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  arkivConfigFromEnv,
  arkivSignerFromEnv,
  createArkivPublicClient,
  createArkivWalletClient,
} from '../lib/arkiv.js';
import { createArkivClubStore } from '../lib/arkivClubStore.js';
import { getRelayChainConfig } from '../lib/chainConfig.js';
import { createClubChain } from '../lib/clubChain.js';
import { createClubVerifier } from '../lib/clubIntent.js';
import { createClubService } from '../lib/clubs.js';
import { IntentError } from '../lib/intentError.js';
import { getRelayerPublicClient } from '../lib/relayer.js';

type ClubService = ReturnType<typeof createClubService>;

const MAX_REQUEST_BYTES = 8 * 1024;

function buildClubService(): ClubService {
  const config = arkivConfigFromEnv();
  const store = createArkivClubStore(
    createArkivPublicClient(config),
    createArkivWalletClient(arkivSignerFromEnv(), config)
  );
  const relay = getRelayChainConfig();
  const registry = relay.contracts.groupRegistry;
  if (!registry) throw new Error('[clubs] No GroupRegistry address for this chain');
  const client = getRelayerPublicClient();
  return createClubService({
    store,
    chain: createClubChain(client as never, registry),
    verify: createClubVerifier(client, relay.chainId),
  });
}

/** Club feed, settings, admins, join requests and notification choices (membership stays on chain). */
export function createClubRoutes(getService: () => ClubService = lazyService(buildClubService)) {
  const clubs = new Hono();

  const respond = async (c: Context, run: () => Promise<unknown>) => {
    try {
      return c.json(await run());
    } catch (error) {
      if (!(error instanceof IntentError)) throw error;
      return c.json({ error: error.message, code: error.code }, error.status);
    }
  };

  clubs.post(
    '/action',
    bodyLimit({
      maxSize: MAX_REQUEST_BYTES,
      onError: (c) => c.json({ error: 'Payload too large' }, 413),
    }),
    async (c) => {
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== 'object') return c.json({ error: 'Invalid JSON body' }, 400);
      return respond(c, () => getService().apply(body as { intent: unknown; signature: string }));
    }
  );

  clubs.get('/settings', (c) =>
    respond(c, () =>
      getService().settingsFor((c.req.query('ids') ?? '').split(',').filter(Boolean))
    )
  );
  clubs.get('/:id', (c) => respond(c, () => getService().state(c.req.param('id'))));
  clubs.get('/:id/feed', (c) =>
    respond(c, () => getService().feed(c.req.param('id'), Number(c.req.query('limit') ?? 20)))
  );
  clubs.get('/:id/notify/:member', (c) =>
    respond(c, () => getService().notifyLevel(c.req.param('id'), c.req.param('member')))
  );

  return clubs;
}

function lazyService<T>(build: () => T): () => T {
  let service: T | null = null;
  return () => {
    service ??= build();
    return service;
  };
}

export const clubs = createClubRoutes();
