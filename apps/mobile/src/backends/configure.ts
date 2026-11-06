import {
  services,
  setChainMode,
  setIpfsConfig,
  setLocalRpcUrl,
  setSepoliaRpcUrl,
} from '@repo/shared';
import { ENV, getChainMode, getCurrentUserId, getLocalRpcUrl } from '@/constants/config';
import { DEV_TOOLS } from '@/constants/devTools';
import { startRelayQueue } from '@/services/relayQueue';
import { registerAccountDeleteIntents } from './accountDeleteIntents';
import { getActiveProfileId } from './activeProfile';
import { apiConfigFor } from './apiConfig';
import { setBalanceReader } from './balanceSource';
import { registerClubIntents } from './clubIntents';
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
  if (getChainMode() === 'local') {
    setLocalRpcUrl(getLocalRpcUrl());
  }
  setSepoliaRpcUrl(ENV.SEPOLIA_RPC_URL);
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
        (require('./sandbox/sandboxApi') as typeof import('./sandbox/sandboxApi')).createSandboxApi(
          undefined,
          sandboxClubDeps()
        ).fetch,
    })
  );
  startRelayQueue();
  registerProfileIntents();
  registerMembershipIntents();
  registerClubIntents();
  registerPostIntents();
  registerReportIntents();
  registerAccountDeleteIntents();
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

/**
 * Who owns each club and who belongs, for the Sandbox's stand-in club API: the seeded members, plus
 * the signed-in athlete when they have joined on this device.
 */
function sandboxClubDeps() {
  const { useCommunityStore } =
    require('@/stores/communityStore') as typeof import('@/stores/communityStore');
  const { seededClubMembers } =
    require('./sandbox/sandboxClubs') as typeof import('./sandbox/sandboxClubs');
  return {
    owner: (clubId: string) =>
      useCommunityStore.getState().clubs.find((c) => c.id === clubId)?.owner ?? null,
    isMember: (clubId: string, member: string) => {
      const state = useCommunityStore.getState();
      const owner = state.clubs.find((c) => c.id === clubId)?.owner?.toLowerCase();
      return (
        owner === member ||
        seededClubMembers(clubId).includes(member) ||
        (state.joinedClubIds.includes(clubId) && member === getCurrentUserId()?.toLowerCase())
      );
    },
  };
}
