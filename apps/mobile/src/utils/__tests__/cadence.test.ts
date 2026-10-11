import { describe, expect, it } from 'vitest';
import type { ActivityStream } from '@/types';
import { cadenceSeries, cadenceSummary, type StepSample, withCadence } from '@/utils/cadence';

/** Samples every `everyS` seconds gaining `stepsPerSecond * everyS` pedometer steps. */
const sampled = (stepsPerSecond: number, everyS: number, count: number): StepSample[] =>
  Array.from({ length: count }, (_, i) => ({
    t: i * everyS * 1000,
    steps: i * everyS * stepsPerSecond,
  }));

describe('cadenceSeries', () => {
  it('has nothing to say without at least two pedometer reads', () => {
    expect(cadenceSeries([{ t: 0, steps: 20 }])).toEqual({ t: [], spm: [] });
    expect(cadenceSeries([])).toEqual({ t: [], spm: [] });
  });

  it('attaches the series only when both the stream and the pedometer recorded', () => {
    const stream: ActivityStream = { t: [0, 1], speed: [2, 2], startedAt: 0 };
    const samples = [
      { t: 0, steps: 0 },
      { t: 4000, steps: 10 },
    ];

    expect(withCadence(undefined, samples)).toBeUndefined();
    const withData = withCadence(stream, samples) as ActivityStream;
    expect(withData.cadence).toEqual(cadenceSeries(samples));
    expect(withCadence(stream, [{ t: 0, steps: 1 }])).toEqual(stream);
  });

  it('reads a steady 150 steps per minute as 150 spm in every window', () => {
    // 2.5 steps/s over the trailing 10 s window is 150 spm however wide the runway is.
    expect(cadenceSeries(sampled(2.5, 2, 6))).toEqual({
      t: [2, 4, 6, 8, 10],
      spm: [150, 150, 150, 150, 150],
    });
  });

  it('reads a still pedometer as zero', () => {
    const still: StepSample[] = Array.from({ length: 6 }, (_, i) => ({ t: i * 2000, steps: 40 }));
    expect(cadenceSeries(still)).toEqual({ t: [2, 4, 6, 8, 10], spm: [0, 0, 0, 0, 0] });
  });

  it('peaks where steps come faster and averages only the moving windows', () => {
    // 4 s standing still, then 12 steps every 2 s (360 spm). Early windows lack a
    // full 10 s runway, so the peak lands once the burst fills the window.
    const burst: StepSample[] = [
      { t: 0, steps: 0 },
      { t: 2000, steps: 0 },
      { t: 4000, steps: 0 },
      { t: 6000, steps: 12 },
      { t: 8000, steps: 24 },
      { t: 10000, steps: 36 },
      { t: 12000, steps: 48 },
      { t: 14000, steps: 60 },
    ];

    const series = cadenceSeries(burst);

    expect(series.t).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(series.spm[6]).toBe(360);
    // (120 + 180 + 270 + 360 + 360) / 5
    expect(cadenceSummary(series)).toEqual({ avg: 258, max: 360 });
  });

  it('blends low and high windows into an avg below the max', () => {
    // 10 s at 150 spm (2.5 steps/s), then 10 s at 90 spm (1.5 steps/s), on a
    // continuous 2 s tick. Windows straddling the change blend the two rates.
    const mix = [
      ...sampled(2.5, 2, 6),
      ...sampled(1.5, 2, 6)
        .slice(1)
        .map((s): StepSample => ({ t: s.t + 10_000, steps: 25 + s.steps })),
    ];

    expect(cadenceSummary(cadenceSeries(mix))).toEqual({ avg: 129, max: 150 });
  });
});

describe('cadence floor', () => {
  it('reads slow walking or fidgeting under 60 steps per minute as no cadence', () => {
    // 0.8 steps/s is 48 spm: strolling, not stepping out.
    const series = cadenceSeries(sampled(0.8, 2, 8));
    expect(series.spm.every((v) => v === 0)).toBe(true);
    expect(cadenceSummary(series)).toEqual({ avg: 0, max: 0 });
  });

  it('ignores a window with fewer than five new steps, even if the rate looks high', () => {
    // 4 steps in 2 s would be 120 spm, but it is a handful of shuffles.
    const shuffle: StepSample[] = [
      { t: 0, steps: 0 },
      { t: 2000, steps: 4 },
    ];
    expect(cadenceSeries(shuffle).spm).toEqual([0]);
    expect(
      cadenceSeries([
        { t: 0, steps: 0 },
        { t: 2000, steps: 5 },
      ]).spm
    ).toEqual([150]);
  });

  it('keeps standing noise out of the average of a real walk', () => {
    const noise: StepSample[] = Array.from({ length: 6 }, (_, i) => ({
      t: i * 2000,
      steps: i % 2,
    }));
    const walk = sampled(2, 2, 7).map((s): StepSample => ({ t: s.t + 10_000, steps: 1 + s.steps }));
    const summary = cadenceSummary(cadenceSeries([...noise, ...walk]));
    expect(summary.avg).toBeGreaterThanOrEqual(100);
    expect(summary.avg).toBeLessThanOrEqual(120);
  });

  it('does not stretch a window across the gap of an auto-pause', () => {
    // Walking at 120 spm, nothing sampled for two minutes (paused), then walking again.
    const before = sampled(2, 1, 11);
    const after = sampled(2, 1, 11).map(
      (s): StepSample => ({
        t: s.t + 130_000,
        steps: 20 + s.steps,
      })
    );
    const { spm } = cadenceSeries([...before, ...after]);

    // Every window that reads at all reads 120: none is diluted by the paused minutes.
    expect(spm.filter((v) => v > 0).every((v) => v === 120)).toBe(true);
    expect(spm[10]).toBe(0);
    expect(spm.slice(14).some((v) => v === 120)).toBe(true);
    expect(cadenceSummary({ t: [], spm }).avg).toBe(120);
  });
});
