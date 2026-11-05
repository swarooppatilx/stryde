import { useProfileStore } from '@/stores/profileStore';
import { summariseBody } from '@/utils/body';

/** The athlete's maximum heart rate: their own figure, else the estimate from their birthday; null until one exists. */
export function useMaxHeartRate(): number | null {
  const birthday = useProfileStore((s) => s.birthday);
  const gender = useProfileStore((s) => s.gender);
  const measured = useProfileStore((s) => s.settings.maxHeartRate);
  return summariseBody({ birthday, gender, maxHeartRate: measured }, new Date()).maxHeartRate;
}
