import type { ActivityType, Split } from '@/types';

/** Sports the running-cost curve describes. Walking and hiking cost differently; cycling very differently. */
const SPORTS = new Set<ActivityType>(['run']);
/** The curve was fitted for grades between these (rise over run). */
const MAX_GRADE = 0.45;

/** Metabolic cost of running at a grade, J per kg per m (Minetti et al. 2002); 3.6 on the flat. */
function runningCost(grade: number): number {
  const g = Math.max(-MAX_GRADE, Math.min(MAX_GRADE, grade));
  return 155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6;
}

const FLAT_COST = runningCost(0);

/** How much harder a grade is than the flat at the same speed: above 1 uphill, below 1 on a gentle downhill, above again on a steep one. A published energy model, not a calibrated race predictor. */
export function gradeFactor(grade: number): number {
  return runningCost(grade) / FLAT_COST;
}

/**
 * The splits as if run on the flat at the same effort: moving time divided by the grade factor,
 * where the grade is the split's net climb over its distance. Null when it does not apply: a sport
 * the curve does not describe, or no split with an elevation.
 */
export function gradeAdjustedSplits(
  splits: readonly Split[],
  activityType: ActivityType
): Split[] | null {
  if (!SPORTS.has(activityType) || !splits.some((s) => s.elevation !== undefined)) return null;
  return splits.map((s) => {
    if (s.elevation === undefined || s.distance <= 0) return s;
    return { ...s, movingTime: Math.round(s.movingTime / gradeFactor(s.elevation / s.distance)) };
  });
}
