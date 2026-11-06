import type { HealthSource, HealthWorkout } from '@/platform/ports';
import type { PostRunInput } from '@/services/postRun';
import { computeStream } from '@/utils/activityStream';
import { toPolyline } from '@/utils/format';
import { climbOfRoute } from '@/utils/healthMapping';
import { logger } from '@/utils/logger';

/** How far back the very first import looks. */
export const FIRST_IMPORT_DAYS = 30;
/** Ids of imported workouts are remembered to avoid repeats; the oldest are forgotten past this. */
export const MAX_REMEMBERED_IDS = 500;

const DAY_MS = 86_400_000;

export interface HealthImportState {
  /** Workouts that started before this have been dealt with; null before the first import. */
  watermark: number | null;
  imported: string[];
}

/** What an activity already on this phone says about when it happened. */
export interface OwnActivitySpan {
  /** When it began (recordings) or was saved (older ones): both readings are tried. */
  createdAt: Date | number;
  /** Its length in ms. */
  duration: number;
}

/** At least this much of the shorter of the two must overlap for it to be the same run. */
const SAME_RUN_OVERLAP = 0.5;

/**
 * Whether a workout in the health data is the same run as one already on this phone, for instance
 * recorded here while a watch recorded it too. Importing it would count the run twice, rewards
 * included. Older activities are dated by when they were saved (their end), newer ones by their
 * start, so each is read both ways.
 */
export function overlapsOwnActivity(
  workout: Pick<HealthWorkout, 'startTime' | 'endTime'>,
  own: readonly OwnActivitySpan[]
): boolean {
  const length = workout.endTime - workout.startTime;
  return own.some((activity) => {
    const at = new Date(activity.createdAt).getTime();
    return [at, at - activity.duration].some((start) => {
      const overlap =
        Math.min(workout.endTime, start + activity.duration) - Math.max(workout.startTime, start);
      return overlap >= SAME_RUN_OVERLAP * Math.min(length, activity.duration);
    });
  });
}

export interface HealthImportDeps {
  health: HealthSource;
  state: { read(): HealthImportState; write(next: HealthImportState): void };
  /** Saves one workout as an activity on this device; throws if it could not. */
  save(workout: HealthWorkout): Promise<void>;
  /** The activities already on this phone, so a run is not imported twice. */
  existing(): readonly OwnActivitySpan[];
  now(): number;
}

export type HealthImportResult =
  | { status: 'done'; imported: number; skipped: number; failed: number }
  | { status: 'unavailable' | 'update-required' | 'no-access' };

/**
 * Brings workouts from the phone's health data in as activities. Each one is imported on its own, so
 * one failure never blocks the rest. The watermark only moves forward when every workout in the
 * batch was handled, and remembered ids keep a rerun from importing anything twice.
 */
export async function importWorkouts(deps: HealthImportDeps): Promise<HealthImportResult> {
  const status = await deps.health.status();
  if (status !== 'available') return { status };
  if (!(await deps.health.hasAccess())) return { status: 'no-access' };

  const start = deps.state.read();
  const since = start.watermark ?? deps.now() - FIRST_IMPORT_DAYS * DAY_MS;
  const workouts = await deps.health.readWorkouts(since);

  let imported = [...start.imported];
  let importedCount = 0;
  let skipped = 0;
  let failed = 0;
  let newest = start.watermark;

  const own = deps.existing();
  for (const workout of workouts) {
    if (imported.includes(workout.id) || overlapsOwnActivity(workout, own)) {
      // The same run already here: remember it, so it is not looked at again.
      if (!imported.includes(workout.id))
        imported = [...imported, workout.id].slice(-MAX_REMEMBERED_IDS);
      skipped++;
      newest = Math.max(newest ?? 0, workout.startTime);
      continue;
    }
    try {
      await deps.save(workout);
    } catch (error) {
      logger.warn('[HealthImport] Could not save a workout', error);
      failed++;
      continue;
    }
    importedCount++;
    imported = [...imported, workout.id].slice(-MAX_REMEMBERED_IDS);
    newest = Math.max(newest ?? 0, workout.startTime);
    deps.state.write({ watermark: start.watermark, imported });
  }

  deps.state.write({ watermark: failed === 0 ? newest : start.watermark, imported });
  return { status: 'done', imported: importedCount, skipped, failed };
}

/** Accuracy given to fixes a watch recorded: health data does not carry one. */
const ROUTE_FIX_ACCURACY_M = 10;

/**
 * The activity an imported workout becomes. Imports stay marked as manual: the data was written by
 * another app, so it never counts toward records the way a recording on this phone does.
 */
export function activityInputFromWorkout(workout: HealthWorkout): PostRunInput {
  const fixes = workout.route?.map((p) => ({ ...p, accuracy: ROUTE_FIX_ACCURACY_M }));
  const stream = fixes ? computeStream(fixes) : undefined;
  const climb = workout.route ? climbOfRoute(workout.route) : null;
  const routeDistance = stream?.d?.at(-1) ?? 0;

  // Readings are timed from the workout's start; the stream counts from its first fix.
  const first = fixes?.[0];
  const offset = first ? Math.round((first.timestamp - workout.startTime) / 1000) : 0;
  const heart = workout.heartRate;
  const shifted = heart
    ? heart.series.t.flatMap((t, i) =>
        t - offset >= 0 ? [{ t: t - offset, bpm: heart.series.bpm[i] as number }] : []
      )
    : [];
  const withHeart =
    stream && shifted.length > 0
      ? { ...stream, heartRate: { t: shifted.map((s) => s.t), bpm: shifted.map((s) => s.bpm) } }
      : stream;

  return {
    title: workout.title ?? '',
    description: 'Imported from Health Connect',
    activityType: workout.sport,
    distance: workout.distanceM > 0 ? workout.distanceM : routeDistance,
    duration: workout.endTime - workout.startTime,
    polyline: workout.route ? toPolyline(workout.route.map((p) => [p.longitude, p.latitude])) : '',
    ...(withHeart && { stream: withHeart }),
    ...(climb && { elevationGain: climb.gain, elevationLoss: climb.loss }),
    ...(heart && { heartRate: { avg: heart.avg, max: heart.max } }),
    ...(workout.calories && { caloriesBurned: workout.calories }),
    territory: null,
    territoryArea: 0,
    photos: [],
    privacy: 'everyone',
    isManual: true,
    isImported: true,
    startedAt: workout.startTime,
  };
}
