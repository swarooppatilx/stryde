import { useActivityStore } from '@/stores/activityStore';
import { useSocialStore } from '@/stores/socialStore';

/**
 * Deletes an activity from this device: the list, the Home feed, and (via the
 * remembered hash) every later chain sync. The on-chain record itself can't be
 * erased, so other devices keep seeing it.
 */
export function deleteActivity(id: string): void {
  const activity = useActivityStore.getState().getActivityById(id);
  useActivityStore.getState().deleteActivity(id);
  useSocialStore.getState().removeActivity(activity?.activityHash || id, id);
}
