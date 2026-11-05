import type { ActivityStream } from '@/types';

/** A read is smoothed across roughly this long, matching the pace curve's window. */
const CADENCE_WINDOW_MS = 10_000;

/** Under this (steps/min) the athlete is standing, shuffling or strolling: not a cadence worth averaging. */
export const MIN_CADENCE_SPM = 60;
/** A window with fewer new steps than this is too little to read a rate from. */
export const MIN_WINDOW_STEPS = 5;
/** Reads further apart than this mean sampling stopped (an auto-pause), so a window must not reach back across them. */
const MAX_SAMPLE_GAP_MS = 5_000;

export interface StepSample {
  t: number;
  steps: number;
}

export interface CadenceSeries {
  /** Seconds since the first read, ascending. */
  t: number[];
  /** Steps per minute over the trailing window at each `t`. */
  spm: number[];
}

/**
 * Steps-per-minute over time from cumulative pedometer reads. Reads arrive on the
 * ~1 Hz session tick, so a window needs two of them; while one builds up the rate
 * spreads over whatever runway exists, like the pace curve does.
 */
export function cadenceSeries(samples: readonly StepSample[]): CadenceSeries {
  const t: number[] = [];
  const spm: number[] = [];
  const first = samples[0];
  if (!first) return { t, spm };

  for (let i = 1; i < samples.length; i++) {
    const at = samples[i] as StepSample;
    let fromIndex = 0;
    for (let j = i - 1; j >= 0; j--) {
      const candidate = samples[j] as StepSample;
      if (at.t - candidate.t >= CADENCE_WINDOW_MS) break;
      if ((samples[j + 1] as StepSample).t - candidate.t > MAX_SAMPLE_GAP_MS) break;
      fromIndex = j;
    }
    const from = samples[fromIndex] as StepSample;
    const seconds = (at.t - from.t) / 1000;
    const steps = at.steps - from.steps;
    t.push(Math.round((at.t - first.t) / 1000));
    // Sensor mid-run resets can move the count backwards, and standing noise is too slow
    // or too few steps to count; both read as zero, as with impossible GPS speeds.
    const rate = seconds > 0 && steps >= MIN_WINDOW_STEPS ? Math.round((steps / seconds) * 60) : 0;
    spm.push(rate >= MIN_CADENCE_SPM ? rate : 0);
  }
  return { t, spm };
}

/** Summary of a run's cadence: mean over the moving (spm > 0) windows, plus the peak. */
export function cadenceSummary(series: CadenceSeries): { avg: number; max: number } {
  const moving = series.spm.filter((s) => s > 0);
  if (moving.length === 0) return { avg: 0, max: 0 };
  const total = moving.reduce((sum, s) => sum + s, 0);
  return { avg: Math.round(total / moving.length), max: Math.max(...moving) };
}

/** Attaches a recorded pedometer series to a saved stream; absent when the sensor stayed silent. */
export function withCadence(
  stream: ActivityStream | undefined,
  samples: readonly StepSample[]
): ActivityStream | undefined {
  const cadence = cadenceSeries(samples);
  if (!stream || cadence.spm.length === 0) return stream;
  return { ...stream, cadence };
}
