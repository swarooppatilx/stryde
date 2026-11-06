import type { WatchSample } from '@/platform/ports';
import type { Location } from '@/types';

/** Readings outside this are sensor glitches (a loose strap reads 0 or 250+). */
const MIN_BPM = 30;
const MAX_BPM = 240;
/** A gap longer than this between readings means the watch wasn't streaming for that stretch. */
const MAX_SAMPLE_GAP_MS = 5_000;
/** The watch's distance replaces the GPS one only when it streamed for most of the moving time... */
export const MIN_WATCH_COVERAGE = 0.9;
/** ...and the two roughly agree; a bigger gap means one of them went wrong, so GPS is kept. */
const MIN_SCALE = 0.75;
const MAX_SCALE = 1.33;

/** Seconds since `startedAt` and the value at each reading that has one passing `keep`. */
function series(
  samples: readonly WatchSample[],
  startedAt: number,
  pick: (s: WatchSample) => number | undefined,
  keep: (v: number) => boolean
): { t: number[]; v: number[] } {
  const t: number[] = [];
  const v: number[] = [];
  for (const sample of samples) {
    const value = pick(sample);
    if (value === undefined || !Number.isFinite(value) || !keep(value)) continue;
    t.push(Math.max(0, Math.round((sample.t - startedAt) / 1000)));
    v.push(Math.round(value));
  }
  return { t, v };
}

const average = (values: readonly number[]) =>
  Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);

/** Average and highest heart rate and the readings behind them; undefined when the watch sent none. */
export function heartRateOf(samples: readonly WatchSample[], startedAt: number) {
  const { t, v } = series(
    samples,
    startedAt,
    (s) => s.heartRate,
    (bpm) => bpm >= MIN_BPM && bpm <= MAX_BPM
  );
  if (v.length === 0) return undefined;
  return { summary: { avg: average(v), max: Math.max(...v) }, series: { t, bpm: v } };
}

/** Steps per minute over the run, from the watch; undefined when it measured none. */
export function cadenceOf(samples: readonly WatchSample[], startedAt: number) {
  const { t, v } = series(
    samples,
    startedAt,
    (s) => s.cadence,
    (spm) => spm > 0 && spm < 300
  );
  return v.length > 0 ? { t, spm: v } : undefined;
}

/** Average power and the readings behind it; undefined when the watch measured none. */
export function powerOf(samples: readonly WatchSample[], startedAt: number) {
  const { t, v } = series(
    samples,
    startedAt,
    (s) => s.power,
    (w) => w > 0 && w < 3000
  );
  if (v.length === 0) return undefined;
  return { avg: average(v), series: { t, w: v } };
}

/** The last total the watch reported for a running sum (distance, calories). */
function lastTotal(samples: readonly WatchSample[], pick: (s: WatchSample) => number | undefined) {
  let total: number | undefined;
  for (const sample of samples) {
    const value = pick(sample);
    if (value !== undefined && Number.isFinite(value) && value >= (total ?? 0)) total = value;
  }
  return total;
}

export const watchDistanceOf = (samples: readonly WatchSample[]) =>
  lastTotal(samples, (s) => s.distance);

export function caloriesOf(samples: readonly WatchSample[]): number | undefined {
  const kcal = lastTotal(samples, (s) => s.calories);
  return kcal && kcal > 0 ? Math.round(kcal) : undefined;
}

/** Share of `movingMs` during which readings kept arriving (no gap over a few seconds). */
export function watchCoverage(samples: readonly WatchSample[], movingMs: number): number {
  if (movingMs <= 0 || samples.length < 2) return 0;
  let covered = 0;
  for (let i = 1; i < samples.length; i++) {
    const gap = (samples[i] as WatchSample).t - (samples[i - 1] as WatchSample).t;
    if (gap > 0 && gap <= MAX_SAMPLE_GAP_MS) covered += gap;
  }
  return Math.min(1, covered / movingMs);
}

/**
 * How much to stretch the GPS distance to match the watch: 1 (keep GPS) unless the watch streamed for
 * most of the run and the two are close enough that the difference is GPS drift, not a failure.
 */
export function watchDistanceScale(
  gpsDistance: number,
  watchDistance: number | undefined,
  coverage: number
): number {
  if (!watchDistance || gpsDistance <= 0 || coverage < MIN_WATCH_COVERAGE) return 1;
  const scale = watchDistance / gpsDistance;
  return scale >= MIN_SCALE && scale <= MAX_SCALE ? scale : 1;
}

/**
 * The track stretched about its first fix so every distance measured along it grows by `scale`; used only
 * to cut splits and best efforts that add up to the watch's distance. The route that is shown stays the GPS one.
 */
export function scaleTrack(locations: readonly Location[], scale: number): Location[] {
  const origin = locations[0];
  if (!origin || scale === 1) return [...locations];
  return locations.map((fix) => ({
    ...fix,
    latitude: origin.latitude + (fix.latitude - origin.latitude) * scale,
    longitude: origin.longitude + (fix.longitude - origin.longitude) * scale,
  }));
}
