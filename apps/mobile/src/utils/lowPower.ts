import type { BatteryState } from '@/platform/ports';
import { ACCURACY_MODE_CONFIG, ACCURACY_MODES, type AccuracyMode } from '@/stores/settingsStore';

/** Unplugged below this share of a full charge counts as low battery. */
export const LOW_BATTERY_LEVEL = 0.15;

export interface TrackingProfileSettings {
  accuracyMode: AccuracyMode;
  timeIntervalMs: number;
  adjustInBatterySaver: boolean;
}

export type LowPowerReason = 'batterySaver' | 'lowBattery';

export interface TrackingProfile {
  accuracyMode: AccuracyMode;
  timeIntervalMs: number;
  /** Why the profile differs from the chosen one; null when it does not. */
  reason: LowPowerReason | null;
}

function reasonFor(battery: BatteryState | null): LowPowerReason | null {
  if (!battery) return null;
  if (battery.lowPowerMode) return 'batterySaver';
  if (!battery.charging && battery.level >= 0 && battery.level < LOW_BATTERY_LEVEL) {
    return 'lowBattery';
  }
  return null;
}

/**
 * The GPS profile to record with: the chosen one, or one notch gentler in battery saver or when the
 * battery is nearly flat. The Low-power setting is the floor, and nothing here ever asks for more
 * than the athlete chose.
 */
export function effectiveTrackingProfile(
  settings: TrackingProfileSettings,
  battery: BatteryState | null
): TrackingProfile {
  const chosen: TrackingProfile = {
    accuracyMode: settings.accuracyMode,
    timeIntervalMs: settings.timeIntervalMs,
    reason: null,
  };
  const reason = settings.adjustInBatterySaver ? reasonFor(battery) : null;
  if (!reason) return chosen;

  const next = ACCURACY_MODES[ACCURACY_MODES.indexOf(settings.accuracyMode) + 1];
  if (!next) return chosen;
  return {
    accuracyMode: next,
    timeIntervalMs: Math.max(settings.timeIntervalMs, ACCURACY_MODE_CONFIG[next].timeInterval),
    reason,
  };
}

/** Whether two profiles ask the GPS for the same thing, so a restart can be skipped. */
export function sameProfile(a: TrackingProfile, b: TrackingProfile): boolean {
  return a.accuracyMode === b.accuracyMode && a.timeIntervalMs === b.timeIntervalMs;
}
