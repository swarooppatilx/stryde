import type { HealthWorkout } from '@/platform/ports';
import { sportFamily } from '@/utils/activityStats';
import { haversineDistance } from '@/utils/geo';
import type { ImportedTrack } from '@/utils/importTrack';
import { computeSplits } from '@/utils/splits';
import { activityInputFromWorkout } from './healthImport';
import type { PostRunInput } from './postRun';

/** A track shorter than this (m) is the phone sitting still, not an activity. */
const MIN_DISTANCE_M = 10;
/** Accuracy given to fixes read from a file: files do not carry one. */
const FIX_ACCURACY_M = 10;

export type TrackImport =
  | {
      ok: true;
      input: PostRunInput;
      /** The same for the same track, to notice a second import. */
      key: string;
    }
  | { ok: false; reason: 'no-times' | 'too-short' };

export interface TrackImportOptions {
  description: string;
  /** Length of each split in metres: a kilometre or a mile. */
  splitMeters: number;
}

/**
 * The activity a track from a file becomes. Like any import from another app it is marked manual,
 * so it never counts toward records. Every point needs a time, in order: without them there is no
 * moving time, pace or splits to show.
 */
export function activityFromTrack(track: ImportedTrack, options: TrackImportOptions): TrackImport {
  const route: NonNullable<HealthWorkout['route']> = [];
  for (const p of track.points) {
    if (p.timestamp === undefined) return { ok: false, reason: 'no-times' };
    const previous = route.at(-1);
    if (previous && p.timestamp < previous.timestamp) return { ok: false, reason: 'no-times' };
    route.push({
      latitude: p.latitude,
      longitude: p.longitude,
      timestamp: p.timestamp,
      ...(p.altitude !== undefined && { altitude: p.altitude }),
    });
  }
  const first = route[0];
  const last = route.at(-1);
  if (!first || !last || last.timestamp <= first.timestamp)
    return { ok: false, reason: 'no-times' };

  let distanceM = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    if (a && b) distanceM += haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
  }
  if (distanceM < MIN_DISTANCE_M) return { ok: false, reason: 'too-short' };

  const seconds = (timestamp: number) => Math.round((timestamp - first.timestamp) / 1000);
  const beats = track.points.flatMap((p) =>
    p.heartRate !== undefined && p.timestamp !== undefined
      ? [{ t: seconds(p.timestamp), bpm: p.heartRate }]
      : []
  );
  const heartRate =
    beats.length > 0
      ? {
          avg: Math.round(beats.reduce((sum, b) => sum + b.bpm, 0) / beats.length),
          max: Math.max(...beats.map((b) => b.bpm)),
          series: { t: beats.map((b) => b.t), bpm: beats.map((b) => b.bpm) },
        }
      : undefined;

  // Running files count the strides of one foot; the app counts steps of both.
  const perFoot = sportFamily(track.sport) === 'foot' ? 2 : 1;
  const steps = track.points.flatMap((p) =>
    p.cadence !== undefined && p.timestamp !== undefined
      ? [{ t: seconds(p.timestamp), spm: Math.round(p.cadence * perFoot) }]
      : []
  );

  const workout: HealthWorkout = {
    id: `file:${first.timestamp}`,
    sport: track.sport,
    startTime: first.timestamp,
    endTime: last.timestamp,
    distanceM,
    ...(track.name && { title: track.name }),
    ...(heartRate && { heartRate }),
    route,
  };

  const base = activityInputFromWorkout(workout);
  const stream =
    base.stream && steps.length > 0
      ? { ...base.stream, cadence: { t: steps.map((s) => s.t), spm: steps.map((s) => s.spm) } }
      : base.stream;
  const splits = computeSplits(
    route.map((p) => ({ ...p, accuracy: FIX_ACCURACY_M })),
    options.splitMeters
  );

  return {
    ok: true,
    input: {
      ...base,
      description: options.description,
      ...(stream && { stream }),
      ...(splits.length > 0 && { splits }),
      ...(track.laps && track.laps.length > 1 && { laps: track.laps }),
    },
    key: `file:${first.timestamp}:${Math.round(distanceM)}`,
  };
}
