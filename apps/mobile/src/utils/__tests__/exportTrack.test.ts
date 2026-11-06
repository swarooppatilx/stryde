import { describe, expect, it } from 'vitest';
import { buildExportTrack } from '@/utils/exportTrack';

const route: [number, number][] = [
  [73.8, 18.5],
  [73.8, 18.501],
  [73.8, 18.502],
];

const base = {
  name: 'Morning run',
  activityType: 'run' as const,
  distance: 222,
  duration: 60_000,
  createdAt: new Date('2026-10-16T06:01:00Z'),
};

describe('buildExportTrack', () => {
  it('needs a line to export', () => {
    expect(buildExportTrack(base, [[73.8, 18.5]])).toBeNull();
  });

  it('spreads time and distance over the route by distance share', () => {
    const track = buildExportTrack(base, route);
    expect(track?.points.map((p) => p.distance)).toEqual([0, 111, 222]);
    expect(track?.points[0]?.timestamp).toBe(Date.parse('2026-10-16T06:00:00Z'));
    expect(track?.points[2]?.timestamp).toBe(Date.parse('2026-10-16T06:01:00Z'));
  });

  it('lines heart rate and cadence up with the recorded time', () => {
    const track = buildExportTrack(
      {
        ...base,
        stream: {
          t: [0, 60],
          speed: [0, 0],
          startedAt: Date.parse('2026-10-16T06:00:00Z'),
          heartRate: { t: [0, 30], bpm: [120, 150] },
          cadence: { t: [0], spm: [80] },
        },
      },
      route,
      [10, 11, 12]
    );
    expect(track?.points.map((p) => p.heartRate)).toEqual([120, 150, 150]);
    expect(track?.points.map((p) => p.cadence)).toEqual([80, 80, 80]);
    expect(track?.points.map((p) => p.altitude)).toEqual([10, 11, 12]);
  });

  it('ignores elevations that do not line up with the route', () => {
    const track = buildExportTrack(base, route, [10, 11]);
    expect(track?.points[0]?.altitude).toBeUndefined();
  });
});
