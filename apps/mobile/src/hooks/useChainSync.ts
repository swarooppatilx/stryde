import { services, setLocalRpcUrl } from '@repo/shared';
import { useEffect, useRef, useState } from 'react';
import { ENV, getLocalRpcUrl } from '@/constants/config';
import { useActivityStore } from '@/stores/activityStore';
import { useProfileStore } from '@/stores/profileStore';
import { useTerritoryStore } from '@/stores/territoryStore';
import { ensureLocalWalletFunded } from '@/utils/anvilFaucet';
import { Toast } from '@/utils/toast';
import { useViemWallet } from './useViemWallet';

export function useChainSync() {
  const { wallet, address, isLoading: walletLoading } = useViemWallet(ENV.CHAIN_MODE);
  const [syncing, setSyncing] = useState(true);
  const syncedAddress = useRef<string | null>(null);

  // The sync effect below only runs once a wallet exists — for a logged-out
  // user (no wallet to sync), it never runs at all, so `syncing` would stay
  // true forever. Since RootLayoutNav gates the whole navigator (including
  // the login/onboarding screens) behind `!syncing`, that left a logged-out
  // user stuck on the splash screen permanently, unable to even reach login.
  useEffect(() => {
    if (!walletLoading && !wallet) {
      setSyncing(false);
    }
  }, [walletLoading, wallet]);

  useEffect(() => {
    if (ENV.CHAIN_MODE === 'local') {
      setLocalRpcUrl(getLocalRpcUrl());
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
    syncedAddress.current = address;
    const walletAddress = address as `0x${string}`;

    let cancelled = false;

    async function sync() {
      try {
        // Prefer a single composed subgraph query (Profile + Activity +
        // Territory + Season/Achievement in one round trip) over the three
        // separate per-registry calls below. Falls back to those calls when
        // no subgraph is configured for the active chain mode (e.g. local
        // Anvil) or the composite query itself fails/returns nothing (e.g. a
        // wallet with no indexed profile yet).
        type NormalizedTerritory = {
          id: string;
          areaSqm: number;
          strength: number;
          capturedAt: number;
          lastReinforced: number;
        };

        let activities: services.sync.SyncedActivity[];
        let territories: NormalizedTerritory[];
        let profile: services.sync.SyncedProfile;

        const composite = await services.subgraph.getAthleteComposite(walletAddress).catch((e) => {
          console.warn('[ChainSync] Composite subgraph query failed, falling back:', e);
          return null;
        });

        if (composite) {
          activities = composite.activities;
          territories = composite.territories;
          profile = { isRegistered: true, profileId: composite.profileId };
        } else {
          // allSettled: one registry read failing (e.g. territories) must not
          // throw away the activities/profile that did sync fine.
          const [activitiesResult, territoriesResult, profileResult] = await Promise.allSettled([
            services.sync.syncActivitiesFromChain(walletAddress),
            services.sync.syncTerritoriesFromChain(walletAddress),
            services.sync.syncProfileFromChain(walletAddress),
          ]);
          for (const r of [activitiesResult, territoriesResult, profileResult]) {
            if (r.status === 'rejected')
              console.warn('[ChainSync] Partial sync failure:', r.reason);
          }
          const rawActivities =
            activitiesResult.status === 'fulfilled' ? activitiesResult.value : [];
          const rawTerritories =
            territoriesResult.status === 'fulfilled' ? territoriesResult.value : [];
          const rawProfile =
            profileResult.status === 'fulfilled'
              ? profileResult.value
              : { isRegistered: false, profileId: null };
          activities = rawActivities;
          territories = rawTerritories.map((t) => ({
            id: t.id,
            areaSqm: t.areaSqm,
            strength: t.controlStrength,
            capturedAt: t.capturedAt,
            lastReinforced: t.lastReinforced,
          }));
          profile = rawProfile;
        }
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
              name: local?.name || a.metadataName || '',
              description: local?.description || a.metadataDescription,
              activityType: local?.activityType || a.activityType,
              distance: local?.distance ?? a.distance,
              duration: local?.duration ?? a.duration,
              polyline: local?.polyline || a.metadataPolyline || '',
              territory: local?.territory || a.metadataTerritory || null,
              territoryArea: local?.territoryArea ?? a.territoryArea,
              createdAt: local?.createdAt || new Date(a.timestamp * 1000),
              txHash: local?.txHash,
              metadataCid: local?.metadataCid ?? a.metadataCid,
              image: local?.image ?? a.metadataPhotos?.[0],
              images: local?.images ?? a.metadataPhotos,
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
          useTerritoryStore.getState().setTerritories(walletAddress, territories);
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
