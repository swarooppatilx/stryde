import { useMaxHeartRate } from '@/hooks/useMaxHeartRate';
import { useActivityStore } from '@/stores/activityStore';
import { useProfileStore } from '@/stores/profileStore';
import type { Activity } from '@/types';
import { isPlausibleBestEffort } from '@/utils/bestEfforts';
import { timeInZones } from '@/utils/heartRateZones';
import { thresholdSpeed, timeInPaceZones } from '@/utils/paceZones';
import { personalRecords, recordsHeldBy } from '@/utils/personalRecords';
import { similarRuns } from '@/utils/similarRuns';

/** Best efforts, similar runs, records and heart-rate zones for one activity; history-based figures are the owner's alone and empty for others' activities. */
export function useActivityInsights(activity: Activity | null | undefined, isOwner: boolean) {
  const ownActivities = useActivityStore((s) => s.activities);
  const maxHr = useMaxHeartRate();
  const restingHr = useProfileStore((s) => s.settings.restingHeartRate);
  const zoneFloors = useProfileStore((s) => s.settings.hrZoneFloors);
  const heartRateStream = activity?.stream?.heartRate;

  const bestEfforts = (activity?.bestEfforts ?? []).filter((effort) =>
    activity ? isPlausibleBestEffort(effort, activity.distance, activity.activityType) : false
  );
  const zoneTimes =
    isOwner && heartRateStream && maxHr
      ? timeInZones(heartRateStream, maxHr, restingHr, zoneFloors)
      : [];
  const similar = activity && isOwner ? similarRuns(activity, ownActivities) : null;
  // Records only compare like with like: a ride must not take the running 5 km badge.
  const sameSport = activity
    ? ownActivities.filter((a) => a.activityType === activity.activityType)
    : [];
  const heldRecords =
    activity && isOwner
      ? recordsHeldBy(personalRecords(sameSport), activity.id, sameSport.length)
      : [];

  const threshold =
    activity && isOwner ? thresholdSpeed(ownActivities, activity.activityType, Date.now()) : null;
  const paceZones =
    activity?.stream && threshold
      ? timeInPaceZones(activity.stream, activity.activityType, threshold)
      : [];

  return {
    paceZones,
    threshold,
    bestEfforts,
    zoneTimes,
    similar,
    heldRecords,
    maxHr,
    restingHr,
    hasHeartRate: heartRateStream !== undefined,
  };
}
