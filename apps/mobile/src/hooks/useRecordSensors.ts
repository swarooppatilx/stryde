import { useMemo } from 'react';
import { useMaxHeartRate } from '@/hooks/useMaxHeartRate';
import { useSensorHub } from '@/hooks/useSensorHub';
import { useProfileStore } from '@/stores/profileStore';
import { useSensorStore } from '@/stores/sensorStore';
import type { HeartRateProfile } from '@/utils/liveStats';

/** What the Record screen needs about sensors: the counts for the options row and the zone reference for heart rate. */
export function useRecordSensors() {
  const hub = useSensorHub();
  const paired = useSensorStore((s) => s.paired);
  const maxHr = useMaxHeartRate();
  const restingHr = useProfileStore((s) => s.settings.restingHeartRate);
  const floors = useProfileStore((s) => s.settings.hrZoneFloors);

  const connected = hub.links.filter((l) => l.status === 'connected').length;
  const pairedCount = new Set(Object.values(paired).flatMap((p) => (p ? [p.id] : []))).size;
  const hrProfile = useMemo<HeartRateProfile | null>(
    () => (maxHr ? { maxHr, restingHr, floors } : null),
    [maxHr, restingHr, floors]
  );

  return { counts: { connected, paired: pairedCount }, hrProfile };
}
