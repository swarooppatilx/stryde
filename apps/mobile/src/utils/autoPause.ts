import type { ActivityType } from '@/types';

const ON_FOOT: ReadonlySet<ActivityType> = new Set<ActivityType>(['run', 'walk', 'hike']);

interface AutoPauseSettings {
  autoPauseOnFoot: boolean;
  autoPause: boolean;
}

/** Whether a recording of this sport pauses by itself when the athlete stops moving. */
export function autoPauseFor(activityType: ActivityType, settings: AutoPauseSettings): boolean {
  return ON_FOOT.has(activityType) ? settings.autoPauseOnFoot : settings.autoPause;
}
