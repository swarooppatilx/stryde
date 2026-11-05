import { services, setChainMode, setIpfsConfig } from '@repo/shared';
import { ENV, getChainMode } from '@/constants/config';
import { DEV_TOOLS } from '@/constants/devTools';
import { startRelayQueue } from '@/services/relayQueue';
import { getActiveProfileId } from './activeProfile';
import { apiConfigFor } from './apiConfig';
import { setBalanceReader } from './balanceSource';
import { registerMembershipIntents } from './membership';
import { registerPostIntents } from './postIntents';
import { registerProfileIntents } from './profileIntents';
import { PROFILES } from './profiles';
import { registerPushIntents } from './pushNotifications';
import { registerReportIntents } from './reportIntents';

let configured = false;

/**
 * Points the shared services at the chain and API for the profile in force. Call it once the
 * profile is known (not at import time, when it may not be loaded yet).
 */
export function configureBackends(): void {
  if (configured) return;
  configured = true;
  setChainMode(getChainMode());
  // A profile with no chain makes every chain and subgraph call fail at once instead of timing out.
  services.client.setChainOffline(PROFILES[getActiveProfileId()].fakeChain);
  // Balances can't be read from a chain that isn't there, so the Sandbox keeps its own. Dev builds
  // only; the require keeps the fake out of release bundles.
  if (DEV_TOOLS.enabled && PROFILES[getActiveProfileId()].fakeChain) {
    setBalanceReader(
      (require('./sandbox/sandboxBalances') as typeof import('./sandbox/sandboxBalances'))
        .sandboxBalanceReader
    );
  }
  // packages/shared has no env config of its own: inject the API base URL/key it needs to upload
  // activity/profile metadata to IPFS via the relay API.
  setIpfsConfig(
    apiConfigFor({
      profile: PROFILES[getActiveProfileId()],
      apiUrl: ENV.API_URL,
      apiKey: ENV.API_KEY,
      dev: DEV_TOOLS.enabled,
      // The require keeps the stand-in out of release bundles.
      sandboxFetch: () =>
        (
          require('./sandbox/sandboxApi') as typeof import('./sandbox/sandboxApi')
        ).createSandboxApi().fetch,
    })
  );
  startRelayQueue();
  registerProfileIntents();
  registerMembershipIntents();
  registerPostIntents();
  registerReportIntents();
  registerPushIntents();
  // Sandbox has no chain to read other athletes from, so give it some. Dev builds only; the require
  // keeps the fixtures out of release bundles.
  reapplySandboxSeed();
}

/**
 * Puts the Sandbox's seeded athletes and posts into the feed, and a club and an event into Groups.
 * Called at start-up and again after a sign-out, which wipes every store: without it the next
 * athlete would find an empty app. Does nothing on a profile with a real chain.
 */
export function reapplySandboxSeed(): void {
  if (DEV_TOOLS.enabled && PROFILES[getActiveProfileId()].fakeChain) {
    (require('./sandbox/applySeed') as typeof import('./sandbox/applySeed')).applySeed();
  }
}
