import type { ElevationData } from '@/services/elevationService';
import type { Activity } from '@/types';
import { applyHiddenStats, sportStatSet } from '@/utils/activityStats';
import { estimateCalories } from '@/utils/calories';
import { elevationWorthShowing } from '@/utils/elevationWorthShowing';

type UnitSystem = Parameters<typeof sportStatSet>[1];

/** The stat grid shown on an activity: measured figures where the device gave them, estimates otherwise. */
export function activityHeadlineStats(
  activity: Activity,
  opts: {
    elevationData: ElevationData | null | undefined;
    isOwner: boolean;
    ownWeightKg: number | undefined;
    unitSystem: UnitSystem;
  }
) {
  const { elevationData, isOwner, ownWeightKg, unitSystem } = opts;
  const worthShowing = elevationData && elevationWorthShowing(elevationData);
  const stats = sportStatSet(
    {
      activityType: activity.activityType,
      distance: activity.distance,
      duration: activity.duration,
      elevationGain: activity.elevationGain ?? elevationData?.totalAscent,
      maxElevation: worthShowing ? Math.max(...elevationData.elevations) : undefined,
      stream: activity.stream,
      // A measured figure from the device beats an estimate.
      calories:
        activity.caloriesBurned ??
        estimateCalories({
          activityType: activity.activityType,
          distance: activity.distance,
          duration: activity.duration,
          // Only the athlete's own weight is known, so only their own activity gets an estimate.
          weightKg: isOwner ? ownWeightKg : undefined,
        }),
      heartRate: activity.heartRate,
      elapsed: activity.stream ? (activity.stream.t.at(-1) ?? 0) * 1000 : undefined,
    },
    unitSystem
  );
  return applyHiddenStats(stats, activity.hiddenStats, isOwner);
}
