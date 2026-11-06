import { Hono } from 'hono';
import { type AccountErasers, createAccountDeleteService } from '../lib/accountDelete.js';
import { createAccountDeleteVerifier } from '../lib/accountDeleteIntent.js';
import {
  arkivConfigFromEnv,
  arkivSignerFromEnv,
  createArkivPublicClient,
  createArkivWalletClient,
} from '../lib/arkiv.js';
import { createArkivCommentLikeStore } from '../lib/arkivCommentLikeStore.js';
import { endBeaconsFor } from '../lib/arkivFitness.js';
import { createArkivFollowStore } from '../lib/arkivFollowStore.js';
import { createArkivPostStore } from '../lib/arkivPostStore.js';
import { createArkivAboutStore } from '../lib/arkivProfileAboutStore.js';
import { createArkivPushTokenStore } from '../lib/arkivPushTokenStore.js';
import { createArkivReportStore } from '../lib/arkivReportStore.js';
import { getRelayChainConfig } from '../lib/chainConfig.js';
import { respondIntent } from '../lib/intentError.js';
import { getRelayerPublicClient } from '../lib/relayer.js';
import { invalidJsonBody, limitBody, readJsonObject } from '../middleware/jsonBody.js';

type AccountDeleteService = ReturnType<typeof createAccountDeleteService>;

const MAX_REQUEST_BYTES = 4 * 1024;

function buildAccountDeleteService(): AccountDeleteService {
  const config = arkivConfigFromEnv();
  const publicClient = createArkivPublicClient(config);
  const walletClient = createArkivWalletClient(arkivSignerFromEnv(), config);
  const erasers: AccountErasers = {
    follows: (owner) => createArkivFollowStore(publicClient, walletClient).removeAllFor(owner),
    posts: (owner) => createArkivPostStore(publicClient, walletClient).removeAllFor(owner),
    about: (owner) => createArkivAboutStore(publicClient, walletClient).removeAllFor(owner),
    commentLikes: (owner) =>
      createArkivCommentLikeStore(publicClient, walletClient).removeAllFor(owner),
    reports: (owner) => createArkivReportStore(publicClient, walletClient).removeAllFor(owner),
    pushTokens: (owner) =>
      createArkivPushTokenStore(publicClient, walletClient).removeAllFor(owner),
    beacons: endBeaconsFor,
  };
  return createAccountDeleteService({
    erasers,
    verify: createAccountDeleteVerifier(getRelayerPublicClient(), getRelayChainConfig().chainId),
  });
}

function lazyService(): () => AccountDeleteService {
  let service: AccountDeleteService | null = null;
  return () => {
    service ??= buildAccountDeleteService();
    return service;
  };
}

/** The service is built on first use, so a missing Arkiv setting fails only this route, not startup. */
export function createAccountRoutes(getService: () => AccountDeleteService = lazyService()) {
  const routes = new Hono();

  routes.post('/delete', limitBody(MAX_REQUEST_BYTES), async (c) => {
    const body = await readJsonObject(c);
    if (!body) return invalidJsonBody(c);
    return respondIntent(c, () =>
      getService().apply(body as { intent: unknown; signature: string })
    );
  });

  return routes;
}

export const account = createAccountRoutes();
