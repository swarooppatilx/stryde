import { describe, expect, it } from 'vitest';
import { activityFromTrack } from '@/services/trackImport';
import type { ImportedTrack } from '@/utils/importTrack';

const START = Date.parse('2026-10-16T06:00:00Z');
const M_PER_DEG = 111_320;

function track(over: Partial<ImportedTrack> = {}, count = 21): ImportedTrack {
  return {
    sport: 'run',
    points: Array.from({ length: count }, (_, i) => ({
      latitude: 18.5 + (i * 100) / M_PER_DEG,
      longitude: 73.8,
      altitude: 100 + i,
      timestamp: START + i * 30_000,
      heartRate: 140 + i,
      cadence: 85,
    })),
    ...over,
  };
}

const options = { description: 'Imported from a file', splitMeters: 1000 };

describe('activityFromTrack', () => {
  it('builds a manual activity with distance, duration, climb, splits and streams', () => {
    const result = activityFromTrack(track(), options);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { input } = result;
    expect(input).toMatchObject({
      activityType: 'run',
      isManual: true,
      startedAt: START,
      duration: 600_000,
      description: 'Imported from a file',
    });
    expect(input.distance).toBeGreaterThan(1990);
    expect(input.distance).toBeLessThan(2010);
    expect(input.elevationGain).toBe(20);
    expect(input.splits?.length).toBe(2);
    expect(input.heartRate).toMatchObject({ max: 160 });
    expect(input.stream?.cadence?.spm[0]).toBe(170);
  });

  it('keeps cadence as given for a ride', () => {
    const result = activityFromTrack(track({ sport: 'ride' }), options);
    expect(result.ok && result.input.stream?.cadence?.spm[0]).toBe(85);
  });

  it('carries laps only when there is more than one', () => {
    const laps = [
      { index: 1, distance: 1000, duration: 300_000 },
      { index: 2, distance: 1000, duration: 300_000 },
    ];
    const withLaps = activityFromTrack(track({ laps }), options);
    expect(withLaps.ok && withLaps.input.laps).toEqual(laps);
    const one = activityFromTrack(track({ laps: laps.slice(0, 1) }), options);
    expect(one.ok && one.input.laps).toBeUndefined();
  });

  it('refuses a track without times, out of order, or too short', () => {
    const noTimes = track();
    noTimes.points[3] = { latitude: 18.5, longitude: 73.8 };
    expect(activityFromTrack(noTimes, options)).toEqual({ ok: false, reason: 'no-times' });

    const backwards = track();
    backwards.points.reverse();
    expect(activityFromTrack(backwards, options)).toEqual({ ok: false, reason: 'no-times' });

    const still = track();
    still.points = still.points.map((p) => ({ ...p, latitude: 18.5 }));
    expect(activityFromTrack(still, options)).toEqual({ ok: false, reason: 'too-short' });
  });

  it('gives the same key for the same track', () => {
    const a = activityFromTrack(track(), options);
    const b = activityFromTrack(track(), options);
    expect(a.ok && b.ok && a.key === b.key).toBe(true);
  });
});
