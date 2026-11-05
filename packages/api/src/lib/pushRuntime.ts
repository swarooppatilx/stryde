import {
  arkivConfigFromEnv,
  arkivSignerFromEnv,
  createArkivPublicClient,
  createArkivWalletClient,
} from './arkiv.js';
import { createArkivPushTokenStore } from './arkivPushTokenStore.js';
import { getRelayChainConfig } from './chainConfig.js';
import { createPushVerifier } from './pushIntent.js';
import { createPushSender, type PushSender } from './pushSender.js';
import { createPushTokenService } from './pushTokens.js';
import { getRelayerPublicClient } from './relayer.js';

export type PushTokenService = ReturnType<typeof createPushTokenService>;

export function buildPushTokenService(): PushTokenService {
  const config = arkivConfigFromEnv();
  const store = createArkivPushTokenStore(
    createArkivPublicClient(config),
    createArkivWalletClient(arkivSignerFromEnv(), config)
  );
  const verify = createPushVerifier(getRelayerPublicClient(), getRelayChainConfig().chainId);
  return createPushTokenService({ store, verify });
}

let shared: { service: PushTokenService; sender: PushSender } | null = null;

/** One token service and sender for the process, built on first use so a missing setting fails only push. */
export function getPush() {
  if (!shared) {
    const service = buildPushTokenService();
    shared = {
      service,
      sender: createPushSender({
        fetch,
        tokens: service.directory,
        accessToken: process.env.EXPO_ACCESS_TOKEN,
      }),
    };
  }
  return shared;
}
