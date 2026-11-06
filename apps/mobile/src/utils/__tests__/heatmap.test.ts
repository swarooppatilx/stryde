import { describe, expect, it } from 'vitest';
import { heatCells, inHeatmapPeriod } from '@/utils/heatmap';

const NOW = Date.parse('2026-11-06T12:00:00Z');
const PUNE: [number, number] = [73.86, 18.52];

describe('inHeatmapPeriod', () => {
  it('keeps everything for all time, even without a date', () => {
    expect(inHeatmapPeriod({ coordinates: [PUNE] }, 'all', NOW)).toBe(true);
  });

  it('keeps the last seven days for weekly', () => {
    const route = (daysAgo: number) => ({
      coordinates: [PUNE],
      timestampMs: NOW - daysAgo * 86_400_000,
    });
    expect(inHeatmapPeriod(route(3), 'weekly', NOW)).toBe(true);
    expect(inHeatmapPeriod(route(8), 'weekly', NOW)).toBe(false);
    expect(inHeatmapPeriod({ coordinates: [PUNE] }, 'weekly', NOW)).toBe(false);
  });

  it('keeps only routes started after dark for night', () => {
    // 22:00 and 12:00 in Pune (UTC+5:30).
    expect(
      inHeatmapPeriod(
        { coordinates: [PUNE], timestampMs: Date.parse('2026-11-01T16:30:00Z') },
        'night',
        NOW
      )
    ).toBe(true);
    expect(
      inHeatmapPeriod(
        { coordinates: [PUNE], timestampMs: Date.parse('2026-11-01T06:30:00Z') },
        'night',
        NOW
      )
    ).toBe(false);
  });
});

describe('custom date range', () => {
  it('keeps routes between the chosen days', () => {
    const range = { fromMs: NOW - 10 * 86_400_000, toMs: NOW };
    const at = (daysAgo: number) => ({
      coordinates: [PUNE],
      timestampMs: NOW - daysAgo * 86_400_000,
    });
    expect(inHeatmapPeriod(at(5), 'custom', NOW, range)).toBe(true);
    expect(inHeatmapPeriod(at(20), 'custom', NOW, range)).toBe(false);
    // No range chosen yet: nothing is left out.
    expect(inHeatmapPeriod(at(20), 'custom', NOW, null)).toBe(true);
  });
});

describe('heatCells', () => {
  it('counts distinct activities through each spot', () => {
    const street: [number, number][] = [
      [73.86, 18.52],
      [73.8601, 18.52],
    ];
    const cells = heatCells([
      { coordinates: street },
      { coordinates: street },
      { coordinates: [street[0] as [number, number]] },
    ]);
    const hottest = Math.max(...cells.map((c) => c[2]));
    expect(hottest).toBe(3);
  });

  it('counts a route that doubles back over a spot once', () => {
    const outAndBack: [number, number][] = [
      [73.86, 18.52],
      [73.861, 18.52],
      [73.86, 18.52],
    ];
    expect(heatCells([{ coordinates: outAndBack }]).every((c) => c[2] === 1)).toBe(true);
  });

  it('keeps the hottest cells when there are too many', () => {
    const many = Array.from({ length: 50 }, (_, i) => [73 + i * 0.01, 18] as [number, number]);
    const hot: [number, number][] = [[80, 20]];
    const cells = heatCells(
      [{ coordinates: many }, { coordinates: hot }, { coordinates: hot }],
      4000,
      10
    );
    expect(cells).toHaveLength(10);
    expect(cells[0]?.[2]).toBe(2);
  });
});
