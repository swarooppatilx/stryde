import { services, setLocalRpcUrl } from '@repo/shared';
import { useEffect, useRef, useState } from 'react';
import { ENV, getLocalRpcUrl } from '@/constants/config';
import { useActivityStore } from '@/stores/activityStore';
import { useProfileStore } from '@/stores/profileStore';
import { useTerritoryStore } from '@/stores/territoryStore';
import { ensureLocalWalletFunded } from '@/utils/anvilFaucet';
import { useViemWallet } from './useViemWallet';

export function useChainSync() {
  const { wallet, address } = useViemWallet(ENV.CHAIN_MODE);
  const [syncing, setSyncing] = useState(true);
  const syncedAddress = useRef<string | null>(null);

  useEffect(() => {
    if (ENV.CHAIN_MODE === 'local') {
      setLocalRpcUrl(getLocalRpcUrl());
      ensureLocalWalletFunded();
    }
  }, []);

  useEffect(() => {
    if (!wallet || !address) return;
    if (syncedAddress.current === address) return;
    syncedAddress.current = address;
    const walletAddress = address as `0x${string}`;

    let cancelled = false;

    async function sync() {
      try {
        const [activities, territories, profile] = await Promise.all([
          services.sync.syncActivitiesFromChain(walletAddress),
          services.sync.syncTerritoriesFromChain(walletAddress),
          services.sync.syncProfileFromChain(walletAddress),
        ]);
        if (cancelled) return;

        if (activities.length > 0) {
          const store = useActivityStore.getState();
          const localActivities = store.activities;
          const localByHash = new Map(
            localActivities.filter((a) => a.activityHash).map((a) => [a.activityHash, a])
          );

          const merged = activities.map((a) => {
            const local = localByHash.get(a.activityHash);
            return {
              id: local?.id ?? a.activityHash,
              userId: a.owner,
              name: local?.name || '',
              activityType: local?.activityType || a.activityType,
              distance: local?.distance || a.distance,
              duration: local?.duration || a.duration,
              polyline: local?.polyline || '',
              territory: local?.territory || null,
              territoryArea: local?.territoryArea || a.territoryArea,
              createdAt: local?.createdAt || new Date(a.timestamp * 1000),
              txHash: local?.txHash,
              image: local?.image,
              images: local?.images,
              activityHash: a.activityHash,
              elevationGain: local?.elevationGain,
            };
          });

          const chainHashes = new Set(activities.map((a) => a.activityHash));
          const localOnly = localActivities.filter(
            (a) => !(a.activityHash && chainHashes.has(a.activityHash))
          );

          store.setActivities([...merged, ...localOnly]);
        }

        if (territories.length > 0) {
          useTerritoryStore.getState().setTerritories(
            walletAddress,
            territories.map((t) => ({
              id: t.id,
              areaSqm: t.areaSqm,
              strength: t.controlStrength,
              capturedAt: t.capturedAt,
              lastReinforced: t.lastReinforced,
            }))
          );
        }

        if (profile.isRegistered && profile.profileId) {
          useProfileStore.getState().syncFromChain({
            profileId: profile.profileId.toString(),
          });
        }
      } catch (err) {
        console.warn('[ChainSync] Sync failed:', err);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [wallet, address]);

  return syncing;
}
