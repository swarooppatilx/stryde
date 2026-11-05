import { getPlatform } from '@/platform';
import type { HealthSource } from '@/platform/ports';
import { useBodyStore } from '@/stores/bodyStore';
import { useProfileStore } from '@/stores/profileStore';
import { toCalendarDay } from '@/utils/dates';

/** Sets the current weight (null clears it) and, when it changed, adds today's weigh-in to the history. */
export function saveWeight(kg: number | null): void {
  const previous = useProfileStore.getState().settings.weightKg;
  useProfileStore.getState().updateSettings({ weightKg: kg ?? undefined });
  // A save that changes nothing (editing the profile for another reason) is not a weigh-in.
  const first = useBodyStore.getState().entries.length === 0;
  if (kg !== null && (kg !== previous || first)) {
    useBodyStore.getState().record(toCalendarDay(new Date(getPlatform().clock.now())), kg);
  }
}

/** Sets the height in centimetres; null clears it. */
export function saveHeight(cm: number | null): void {
  useProfileStore.getState().updateSettings({ heightCm: cm ?? undefined });
}

/** Sets the athlete's own maximum heart rate in bpm; null goes back to the age estimate. */
export function saveMaxHeartRate(bpm: number | null): void {
  useProfileStore.getState().updateSettings({ maxHeartRate: bpm ?? undefined });
}

/** Sets the athlete's own heart-rate zone boundaries; null goes back to the usual ones. */
export function saveZoneFloors(floors: readonly [number, number, number, number] | null): void {
  useProfileStore.getState().updateSettings({ hrZoneFloors: floors ?? undefined });
}

/** Sets the athlete's resting heart rate in bpm; null clears it. */
export function saveRestingHeartRate(bpm: number | null): void {
  useProfileStore.getState().updateSettings({ restingHeartRate: bpm ?? undefined });
}

export type BodyFromHealth =
  | { status: 'ok'; weightKg?: number; heightCm?: number; restingHeartRate?: number }
  | { status: 'unavailable' | 'denied' | 'empty' };

/**
 * The latest weight, height and resting heart rate in the phone's health data. Asks for access only when it is not
 * already given. Nothing is saved: the screen shows the values for the athlete to confirm.
 */
export async function readBodyFromHealth(health: HealthSource): Promise<BodyFromHealth> {
  if ((await health.status()) !== 'available') return { status: 'unavailable' };
  if (!(await health.hasBodyAccess()) && !(await health.requestBodyAccess())) {
    return { status: 'denied' };
  }
  const { weightKg, heightCm, restingHeartRate } = await health.readBody();
  if (weightKg === undefined && heightCm === undefined && restingHeartRate === undefined) {
    return { status: 'empty' };
  }
  return {
    status: 'ok',
    ...(weightKg !== undefined && { weightKg }),
    ...(heightCm !== undefined && { heightCm }),
    ...(restingHeartRate !== undefined && { restingHeartRate }),
  };
}
