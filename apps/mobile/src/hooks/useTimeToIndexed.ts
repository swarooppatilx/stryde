import { useEffect, useSyncExternalStore } from 'react';
import { getTimeToIndexed } from '@/services/timeToIndexed';
import type { TimingState } from '@/utils/timeToIndexed';

/** How long the just-saved activity took to be confirmed and to show in search; stops watching on unmount. */
export function useTimeToIndexed(activityId: string | undefined): TimingState {
  const { tracker } = getTimeToIndexed();
  const state = useSyncExternalStore(tracker.subscribe, () =>
    activityId ? tracker.get(activityId) : tracker.get('')
  );
  useEffect(() => {
    if (!activityId) return;
    return () => tracker.cancel(activityId);
  }, [tracker, activityId]);
  return state;
}
