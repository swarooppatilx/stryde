import { useCallback } from 'react';
import { getActiveProfileId } from '@/backends/activeProfile';
import { PROFILES } from '@/backends/profiles';
import { getCurrentUserId } from '@/constants/config';
import { DEV_TOOLS } from '@/constants/devTools';
import { getPlatform } from '@/platform';
import { createSharedActivityChain } from '@/services/activityChain';
import { ipfsPhotoUploader } from '@/services/ipfsService';
import {
  type PostRunInput,
  releaseHeldReward,
  retryOnChain,
  type SavePhase,
  savePostRun,
} from '@/services/postRun';
import { getTimeToIndexed } from '@/services/timeToIndexed';
import { useActivityStore } from '@/stores/activityStore';
import { useTerritoryStore } from '@/stores/territoryStore';
import { useWorldVerificationStore } from '@/stores/worldVerificationStore';
import type { Activity } from '@/types';
import { useViemWallet } from './useViemWallet';

type Clock = ReturnType<typeof getPlatform>['clock'];

function createChain(
  clock: Clock,
  wallet: ReturnType<typeof useViemWallet>['wallet'],
  address: ReturnType<typeof useViemWallet>['address']
) {
  // A profile with no chain gets a stand-in that confirms everything. Dev builds only: a release
  // production build always runs Live, and the require keeps the stand-in out of its bundle.
  if (DEV_TOOLS.enabled && PROFILES[getActiveProfileId()].fakeChain) {
    return (
      require('@/backends/sandbox/sandboxChain') as typeof import('@/backends/sandbox/sandboxChain')
    ).createSandboxChain(clock);
  }
  if (wallet && address) return createSharedActivityChain(wallet, address);
  return null;
}

export function usePostRun() {
  const { wallet, address } = useViemWallet();

  const deps = useCallback(() => {
    const { clock, ids } = getPlatform();
    const activities = useActivityStore.getState();
    // Sandbox confirms everything instantly and has no search index: timing it would be made up.
    const real = !(DEV_TOOLS.enabled && PROFILES[getActiveProfileId()].fakeChain) && !!address;
    const { tracker } = getTimeToIndexed();
    return {
      timing:
        real && address
          ? {
              saved: tracker.saved,
              confirmed: (id: string, hash: `0x${string}`) => tracker.confirmed(id, hash, address),
            }
          : undefined,
      clock,
      ids,
      userId: getCurrentUserId(),
      store: {
        saveActivity: activities.saveActivity,
        updateActivity: activities.updateActivity,
        capturePolygon: useTerritoryStore.getState().capturePolygon,
      },
      uploader: ipfsPhotoUploader,
      // A profile with no chain gets a stand-in that confirms everything. Dev builds only: a release
      // production build always runs Live, and the require keeps the stand-in out of its bundle.
      chain: createChain(clock, wallet, address),
      isVerified: () => useWorldVerificationStore.getState().isVerified,
    };
  }, [wallet, address]);

  const save = useCallback(
    (
      input: PostRunInput,
      onSaved?: (activity: Activity) => void,
      onProgress?: (phase: SavePhase) => void
    ) => savePostRun(input, { ...deps(), onSaved, onProgress }),
    [deps]
  );
  const retry = useCallback((activity: Activity) => retryOnChain(activity, deps()), [deps]);
  const releaseReward = useCallback(
    (activity: Activity) => releaseHeldReward(activity, deps()),
    [deps]
  );

  return { save, retry, releaseReward };
}
