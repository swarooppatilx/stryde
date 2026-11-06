import type { SessionSummary } from '@/services/trackingSession';
import type { ActivityType } from '@/types';

/** The Save screen's route params for a run that was just recorded (all strings, as routes need). */
export function recordedRunParams(
  summary: SessionSummary,
  activityType: ActivityType
): Record<string, string> {
  return {
    recorded: '1',
    ...(summary.mocked ? { mocked: '1' } : {}),
    ...(summary.startedAt === undefined ? {} : { startedAt: String(summary.startedAt) }),
    // A route that doesn't loop back claims no ground: the Save screen says so, quietly.
    ...(summary.territory ? {} : { noTerritory: '1' }),
    polyline: summary.polyline,
    distance: String(summary.distance),
    duration: String(summary.duration),
    territoryArea: String(summary.territoryArea),
    splits: JSON.stringify(summary.splits),
    bestEfforts: JSON.stringify(summary.bestEfforts),
    laps: JSON.stringify(summary.laps),
    ...(summary.stream ? { stream: JSON.stringify(summary.stream) } : {}),
    ...(summary.elevationGain === undefined
      ? {}
      : { elevationGain: String(summary.elevationGain) }),
    ...(summary.elevationLoss === undefined
      ? {}
      : { elevationLoss: String(summary.elevationLoss) }),
    ...(summary.heartRate ? { heartRate: JSON.stringify(summary.heartRate) } : {}),
    ...(summary.caloriesBurned === undefined
      ? {}
      : { caloriesBurned: String(summary.caloriesBurned) }),
    ...(summary.avgPower === undefined ? {} : { avgPower: String(summary.avgPower) }),
    ...(summary.recordedWithWatch ? { watch: '1' } : {}),
    activityType,
    ...(summary.territory ? { territory: JSON.stringify(summary.territory) } : {}),
  };
}
