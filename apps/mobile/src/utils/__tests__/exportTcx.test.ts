import { describe, expect, it } from 'vitest';
import { exportTcx } from '@/utils/exportTcx';
import type { ExportTrack } from '@/utils/exportTrack';
import { tracksFromTcx } from '@/utils/importTcx';

const startedAt = Date.parse('2026-10-16T06:00:00Z');

function track(extra: Partial<ExportTrack> = {}): ExportTrack {
  return {
    name: 'Tom & Jerry <run>',
    sport: 'run',
    startedAt,
    totalDistanceM: 300,
    totalTimeMs: 90_000,
    points: [0, 1, 2, 3].map((i) => ({
      latitude: 18.5 + i * 0.0003,
      longitude: 73.8,
      altitude: 100 + i,
      timestamp: startedAt + i * 30_000,
      heartRate: 140 + i,
      cadence: 80 + i,
      distance: i * 100,
    })),
    ...extra,
  };
}

describe('exportTcx', () => {
  it('round-trips points with heart rate, run cadence, altitude and time', () => {
    const tracks = tracksFromTcx(exportTcx(track()));
    expect(tracks).toHaveLength(1);
    const read = tracks?.[0];
    expect(read?.sport).toBe('run');
    expect(read?.points).toHaveLength(4);
    expect(read?.points[2]).toMatchObject({
      latitude: 18.5006,
      longitude: 73.8,
      altitude: 102,
      heartRate: 142,
      cadence: 82,
      timestamp: startedAt + 60_000,
    });
  });

  it('writes bike cadence in its own element and maps the sport', () => {
    const xml = exportTcx(track({ sport: 'ride' }));
    expect(xml).toContain('<Cadence>80</Cadence>');
    expect(tracksFromTcx(xml)?.[0]?.sport).toBe('ride');
    expect(tracksFromTcx(xml)?.[0]?.points[0]?.cadence).toBe(80);
  });

  it('round-trips marked laps and splits the points between them', () => {
    const laps = [
      { index: 1, distance: 100, duration: 45_000 },
      { index: 2, distance: 200, duration: 45_000 },
    ];
    const xml = exportTcx(track({ laps }));
    expect(xml.match(/<Lap /g)).toHaveLength(2);
    const read = tracksFromTcx(xml)?.[0];
    expect(read?.laps).toEqual(laps);
    expect(read?.points).toHaveLength(4);
  });

  it('writes one lap covering the activity when none were marked', () => {
    expect(tracksFromTcx(exportTcx(track()))?.[0]?.laps).toEqual([
      { index: 1, distance: 300, duration: 90_000 },
    ]);
  });

  it('escapes the name', () => {
    expect(exportTcx(track())).toContain('<Notes>Tom &amp; Jerry &lt;run&gt;</Notes>');
  });
});
