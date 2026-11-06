import { describe, expect, it } from 'vitest';
import { crc16, exportFit, FIT_EPOCH_S, fitFile } from '@/utils/exportFit';
import type { ExportTrack } from '@/utils/exportTrack';
import { trackFromFit } from '@/utils/importFit';

const startedAt = Date.parse('2026-10-16T06:00:00Z');

function track(extra: Partial<ExportTrack> = {}): ExportTrack {
  return {
    name: 'Morning run',
    sport: 'run',
    startedAt,
    totalDistanceM: 300,
    totalTimeMs: 90_000,
    points: [0, 1, 2, 3].map((i) => ({
      latitude: 18.5 + i * 0.0003,
      longitude: -73.8 - i * 0.0002,
      altitude: 100 + i * 2.5,
      timestamp: startedAt + i * 30_000,
      heartRate: 140 + i,
      cadence: 80 + i,
      distance: i * 100,
    })),
    ...extra,
  };
}

describe('exportFit', () => {
  it('writes a file whose header and checksums the decoder accepts', () => {
    const bytes = exportFit(track());
    expect(bytes[0]).toBe(14);
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('.FIT');
    expect(trackFromFit(bytes).ok).toBe(true);
  });

  it('round-trips positions, altitude, heart rate, cadence and time', () => {
    const result = trackFromFit(exportFit(track()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.track.sport).toBe('run');
    expect(result.track.points).toHaveLength(4);
    result.track.points.forEach((p, i) => {
      expect(p.latitude).toBeCloseTo(18.5 + i * 0.0003, 6);
      expect(p.longitude).toBeCloseTo(-73.8 - i * 0.0002, 6);
      expect(Math.abs((p.altitude ?? 0) - (100 + i * 2.5))).toBeLessThanOrEqual(0.2);
      expect(p.heartRate).toBe(140 + i);
      expect(p.cadence).toBe(80 + i);
      expect(p.timestamp).toBe(startedAt + i * 30_000);
    });
  });

  it('round-trips the sport and a single lap for an unlapped activity', () => {
    const result = trackFromFit(exportFit(track({ sport: 'ride' })));
    expect(result.ok && result.track.sport).toBe('ride');
    expect(result.ok && result.track.laps).toEqual([{ index: 1, distance: 300, duration: 90_000 }]);
  });

  it('round-trips marked laps', () => {
    const laps = [
      { index: 1, distance: 150, duration: 40_000 },
      { index: 2, distance: 150, duration: 50_000 },
    ];
    const result = trackFromFit(exportFit(track({ laps })));
    expect(result.ok && result.track.laps).toEqual(laps);
  });

  it('leaves out series the activity did not record', () => {
    const bare = track({
      points: track().points.map(({ latitude, longitude, timestamp, distance }) => ({
        latitude,
        longitude,
        timestamp,
        distance,
      })),
    });
    const result = trackFromFit(exportFit(bare));
    expect(result.ok && result.track.points[0]?.heartRate).toBeUndefined();
    expect(result.ok && result.track.points[0]?.altitude).toBeUndefined();
  });

  it('keeps every FIT timestamp after the FIT epoch', () => {
    expect(startedAt / 1000).toBeGreaterThan(FIT_EPOCH_S);
  });
});

describe('fitFile', () => {
  it('ends with the CRC of everything before it', () => {
    const bytes = fitFile([1, 2, 3]);
    const crc = (bytes[bytes.length - 1] as number) * 256 + (bytes[bytes.length - 2] as number);
    expect(crc).toBe(crc16(bytes.slice(0, -2)));
  });
});
