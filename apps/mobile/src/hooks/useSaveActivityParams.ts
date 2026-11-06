import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import type { ActivityStream, ActivityType, BestEffort, Lap, Ring, Split } from '@/types';
import { peekRecordedRun } from '@/utils/recordedRunHandoff';
import { parseJsonParam } from '@/utils/routeParams';

export type SaveActivityParams = {
  /** '1' when the numbers come from a recording (even a GPS-less one). */
  recorded?: string;
  /** When a recorded run began (ms since 1970). */
  startedAt?: string;
  /** '1' when the recording used a simulated location. */
  mocked?: string;
  /** '1' when the recording didn't loop back, so no territory was captured. */
  noTerritory?: string;
  polyline?: string;
  distance?: string;
  duration?: string;
  territory?: string;
  territoryArea?: string;
  splits?: string;
  stream?: string;
  elevationGain?: string;
  elevationLoss?: string;
  bestEfforts?: string;
  laps?: string;
  /** From the watch, when one recorded alongside: `{avg,max}` JSON, kcal and watts. */
  heartRate?: string;
  caloriesBurned?: string;
  avgPower?: string;
  /** '1' when an Apple Watch streamed during the recording. */
  watch?: string;
  activityType?: ActivityType;
  photos?: string;
};

/** A route param that is a number, or undefined when it was not sent. */
function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * What the save screen was opened with: a just-recorded run (held in memory under a short id, with
 * its per-second points and all) or plain route params, parsed once into typed values.
 */
export function useSaveActivityParams() {
  const routeParams = useLocalSearchParams<SaveActivityParams & { run?: string }>();
  const runId = routeParams.run;
  const params: SaveActivityParams = runId
    ? ((peekRecordedRun(runId) as SaveActivityParams | undefined) ?? {})
    : routeParams;

  const territory = useMemo(
    () => parseJsonParam<Ring | null>(params.territory, 'territory', null),
    [params.territory]
  );
  const splits = useMemo(
    () => parseJsonParam<Split[] | undefined>(params.splits, 'splits', undefined),
    [params.splits]
  );
  const stream = useMemo(
    () => parseJsonParam<ActivityStream | undefined>(params.stream, 'stream', undefined),
    [params.stream]
  );
  const bestEfforts = useMemo(
    () => parseJsonParam<BestEffort[] | undefined>(params.bestEfforts, 'best efforts', undefined),
    [params.bestEfforts]
  );
  const laps = useMemo(
    () => parseJsonParam<Lap[] | undefined>(params.laps, 'laps', undefined),
    [params.laps]
  );

  const heartRate = useMemo(
    () =>
      parseJsonParam<{ avg: number; max: number } | undefined>(
        params.heartRate,
        'heart rate',
        undefined
      ),
    [params.heartRate]
  );

  const isFromTracking = params.recorded === '1' || !!params.polyline;
  return {
    runId,
    isFromTracking,
    activityType: params.activityType,
    initialPhotos: params.photos,
    polyline: params.polyline || '',
    distance: Number.parseFloat(params.distance || '0'),
    duration: Number.parseFloat(params.duration || '0'),
    territory,
    territoryArea: params.territoryArea ? Number.parseFloat(params.territoryArea) : 0,
    splits,
    stream,
    bestEfforts,
    laps,
    elevationGain: optionalNumber(params.elevationGain),
    elevationLoss: optionalNumber(params.elevationLoss),
    heartRate: isFromTracking ? heartRate : undefined,
    caloriesBurned: isFromTracking ? optionalNumber(params.caloriesBurned) : undefined,
    avgPower: isFromTracking ? optionalNumber(params.avgPower) : undefined,
    recordedWithWatch: isFromTracking && params.watch === '1' ? true : undefined,
    mocked: isFromTracking && params.mocked === '1',
    noTerritory: isFromTracking && params.noTerritory === '1',
    startedAt: isFromTracking ? optionalNumber(params.startedAt) : undefined,
  };
}

export type SaveActivityRecording = ReturnType<typeof useSaveActivityParams>;
