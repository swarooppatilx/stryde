import { useEffect, useMemo, useRef } from 'react';
import { getPlatform } from '@/platform';
import { createActivitySync } from '@/services/activitySync';
import { onlineStatus } from '@/services/onlineStatus';
import { isSyncing } from '@/services/postRun';
import { useActivityStore } from '@/stores/activityStore';
import { useOnline } from './useOnline';
import { usePostRun } from './usePostRun';

const DRAIN_EVERY_MS = 60_000;

/** While `enabled`, drains activities saved only on this device to the chain: on open, when connection or wallet arrive, and every minute. */
export function useActivitySync(enabled: boolean) {
  const { retry } = usePostRun();
  const online = useOnline();
  const retryRef = useRef(retry);
  retryRef.current = retry;

  const sync = useMemo(
    () =>
      createActivitySync({
        now: () => getPlatform().clock.now(),
        getActivities: () => useActivityStore.getState().activities,
        retry: (activity) => retryRef.current(activity),
        updateActivity: (id, patch) => useActivityStore.getState().updateActivity(id, patch),
        isOnline: () => onlineStatus.getSnapshot(),
        isSyncing,
      }),
    []
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: `retry` changes identity with the wallet, so a wallet arriving triggers a drain
  useEffect(() => {
    if (!enabled || !online) return;
    void sync.drain();
    const timer = setInterval(() => void sync.drain(), DRAIN_EVERY_MS);
    return () => clearInterval(timer);
  }, [enabled, online, sync, retry]);
}
