import type { AccuracyMode } from '@/stores/settingsStore';

export interface LocationRequest {
  timeIntervalMs: number;
  distanceIntervalM: number;
}

/**
 * How often the background location task asks the OS for a fix. Best accuracy wants about one a
 * second so a turn or a sprint is not cut short; the other modes trade that for battery.
 */
export function locationRequestFor(mode: AccuracyMode): LocationRequest {
  return { timeIntervalMs: mode === 'best' ? 1000 : 5000, distanceIntervalM: 1 };
}
