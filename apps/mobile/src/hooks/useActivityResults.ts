import { useMemo } from 'react';
import { useActivityStore } from '@/stores/activityStore';
import type { Activity } from '@/types';
import { type ActivityResults, activityResults } from '@/utils/activityResults';
import type { UnitSystem } from '@/utils/format';

const NONE: ActivityResults = { bestEffortCount: 0, records: [], achievements: [] };

/** Records and badges come from the athlete's own history, so they are the owner's alone. */
export function useActivityResults(
  activity: Activity | null | undefined,
  isOwner: boolean,
  unitSystem: UnitSystem
): ActivityResults {
  const own = useActivityStore((s) => s.activities);
  return useMemo(
    () => (activity && isOwner ? activityResults(activity, own, unitSystem) : NONE),
    [activity, isOwner, own, unitSystem]
  );
}
