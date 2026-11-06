import type { Activity } from '@/types';
import type { HeartRateProfile } from '@/utils/coachRun';
import { timeInZones } from '@/utils/heartRateZones';

export type EffortSignal = 'easy' | 'moderate' | 'hard';

/** What the athlete said about a run in a voice debrief. */
export interface DebriefReading {
  effort: number | null;
  feel: 'great' | 'good' | 'ok' | 'tough' | 'bad' | null;
}

/** A quarter of the run in zones 4 and 5 is a hard run whatever the athlete called it. */
const HARD_ZONE_SHARE = 0.25;
/** Half the run at zone 3 or above is more than an easy jog. */
const MODERATE_ZONE_SHARE = 0.5;
/** A debrief effort at or above this on the 1 to 10 scale is a hard run. */
const HARD_DEBRIEF_EFFORT = 7;
const EASY_DEBRIEF_EFFORT = 3;

function fromDebrief(debrief: DebriefReading | undefined | null): EffortSignal | null {
  if (!debrief) return null;
  const { effort, feel } = debrief;
  if ((effort !== null && effort >= HARD_DEBRIEF_EFFORT) || feel === 'tough' || feel === 'bad') {
    return 'hard';
  }
  if (effort === null) return null;
  return effort <= EASY_DEBRIEF_EFFORT ? 'easy' : 'moderate';
}

function fromActivity(activity: Activity): EffortSignal | null {
  switch (activity.effort) {
    case 'easy':
      return 'easy';
    case 'moderate':
      return 'moderate';
    case 'hard':
    case 'max':
      return 'hard';
    default:
      return null;
  }
}

function fromZones(activity: Activity, profile: HeartRateProfile): EffortSignal | null {
  const heartRate = activity.stream?.heartRate;
  if (!heartRate || !profile.maxHr) return null;
  const zones = timeInZones(heartRate, profile.maxHr, profile.restingHr, profile.zoneFloors);
  if (zones.length === 0) return null;
  const share = (ids: readonly number[]) =>
    zones.filter((z) => ids.includes(z.zone.id)).reduce((sum, z) => sum + z.share, 0);
  if (share([4, 5]) >= HARD_ZONE_SHARE) return 'hard';
  return share([3, 4, 5]) >= MODERATE_ZONE_SHARE ? 'moderate' : 'easy';
}

/**
 * How hard one run was, from the best source there is: what the athlete said in a debrief, then
 * the effort and feel they marked on the activity, then the heart-rate zones. Null with no signal.
 */
export function effortSignal(
  activity: Activity,
  debrief?: DebriefReading | null,
  profile: HeartRateProfile = {}
): EffortSignal | null {
  const said = fromDebrief(debrief);
  if (said) return said;
  const marked = fromActivity(activity);
  if (marked) return marked;
  if (activity.feel === 'bad' || activity.feel === 'terrible') return 'hard';
  return fromZones(activity, profile);
}
