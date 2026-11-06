import { setLocalRpcUrl } from '@repo/shared';
import { useEffect, useRef, useState } from 'react';
import { getActiveProfileId } from '@/backends/activeProfile';
import { PROFILES } from '@/backends/profiles';
import { getChainMode, getLocalRpcUrl } from '@/constants/config';
import { DEV_TOOLS } from '@/constants/devTools';
import { mergeChainActivities } from '@/services/chainSync';
import { ownAboutDeps } from '@/services/ownAbout';
import { syncOwnAbout } from '@/services/syncOwnAbout';
import { useActivityStore } from '@/stores/activityStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSocialStore } from '@/stores/socialStore';
import { useTerritoryStore } from '@/stores/territoryStore';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';
import { fetchChainSnapshot } from './chainSnapshot';
import { useViemWallet } from './useViemWallet';

export function useChainSync() {
  const { wallet, address, isLoading: walletLoading } = useViemWallet();
  const [syncing, setSyncing] = useState(true);
  const syncedAddress = useRef<string | null>(null);

  // No wallet means no sync will ever run, so don't report "syncing" forever.
  useEffect(() => {
    if (!walletLoading && !wallet) {
      setSyncing(false);
    }
  }, [walletLoading, wallet]);

  useEffect(() => {
    // Sandbox has no node to fund the wallet on; the faucet call would only fail.
    if (
      DEV_TOOLS.enabled &&
      getChainMode() === 'local' &&
      !PROFILES[getActiveProfileId()].fakeChain
    ) {
      setLocalRpcUrl(getLocalRpcUrl());
      const { ensureLocalWalletFunded } =
        require('@/utils/anvilFaucet') as typeof import('@/utils/anvilFaucet');
      ensureLocalWalletFunded().then((result) => {
        if (result === 'funded') {
          Toast.info('Funded with 100 ETH for local testing', 2);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!wallet || !address) return;
    if (syncedAddress.current === address) return;
    const walletAddress = address as `0x${string}`;

    let cancelled = false;

    async function sync() {
      try {
        const { activities, territories, profile } = await fetchChainSnapshot(walletAddress);
        if (cancelled) return;

        if (activities.length > 0) {
          const store = useActivityStore.getState();
          store.setActivities(
            mergeChainActivities(store.activities, activities, new Set(store.deletedHashes))
          );
        }

        if (territories) {
          useTerritoryStore.getState().setTerritories(walletAddress, territories);
        }

        if (profile.isRegistered && profile.profileId) {
          useProfileStore.getState().syncFromChain({
            profileId: profile.profileId.toString(),
          });
        }

        void useSocialStore.getState().syncFollowing(walletAddress);
        void syncOwnAbout(ownAboutDeps(), walletAddress);
      } catch (err) {
        logger.warn('[ChainSync] Sync failed:', err);
      } finally {
        if (!cancelled) {
          // Marking synced up front would block the re-run after a cancelled attempt and leave the splash up forever.
          syncedAddress.current = walletAddress;
          setSyncing(false);
        }
      }
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, [wallet, address]);

  return syncing;
}
