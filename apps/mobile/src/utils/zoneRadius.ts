import {
  PRIVACY_ZONE_RADIUS_MAX,
  PRIVACY_ZONE_RADIUS_MIN,
  PRIVACY_ZONE_RADIUS_STEP,
} from '@/constants/limits';

/** The next privacy-zone radius up (1) or down (-1), kept on the step grid and inside the limits. */
export function stepZoneRadius(current: number, direction: 1 | -1): number {
  const steps = current / PRIVACY_ZONE_RADIUS_STEP;
  const onGrid = direction === 1 ? Math.floor(steps) + 1 : Math.ceil(steps) - 1;
  const next = onGrid * PRIVACY_ZONE_RADIUS_STEP;
  return Math.min(PRIVACY_ZONE_RADIUS_MAX, Math.max(PRIVACY_ZONE_RADIUS_MIN, next));
}
