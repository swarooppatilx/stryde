import { describe, expect, it } from 'vitest';
import { territoryService } from '@/services/territoryService';
import type { Location } from '@/types';
import { MAX_TERRITORY_AREA_M2, MIN_TERRITORY_AREA_M2 } from '@/utils/territoryLoops';

const LAT = 18.5;
const LNG = 73.8;
const M_LAT = 111_320;
const M_LNG = 111_320 * Math.cos((LAT * Math.PI) / 180);

/** A fix `eastM`/`northM` meters from the origin, one second after the previous. */
let clock = 0;
const at = (eastM: number, northM: number): Location => ({
  latitude: LAT + northM / M_LAT,
  longitude: LNG + eastM / M_LNG,
  timestamp: 1_000_000 + 1000 * clock++,
  accuracy: 5,
});

const circle = (cx: number, cy: number, r: number, points = 48, startAngle = 0): Location[] =>
  Array.from({ length: points + 1 }, (_, i) => {
    const a = startAngle + (2 * Math.PI * i) / points;
    return at(cx + r * Math.cos(a), cy + r * Math.sin(a));
  });

const line = (x0: number, y0: number, x1: number, y1: number, steps = 40): Location[] =>
  Array.from({ length: steps + 1 }, (_, i) =>
    at(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps)
  );

const areaOf = (track: Location[]) => {
  const ring = territoryService.getEnclosedPolygon(track);
  return ring ? territoryService.getPolygonArea(ring) : null;
};

describe('claiming territory from a track', () => {
  it('claims a plain loop at its true area', () => {
    clock = 0;
    const area = areaOf(circle(0, 0, 100));
    expect(area).toBeGreaterThan(Math.PI * 100 * 100 * 0.95);
    expect(area).toBeLessThan(Math.PI * 100 * 100 * 1.05);
  });

  it('claims nothing for an out-and-back, even with GPS wobble across the road', () => {
    clock = 0;
    const out = line(0, 0, 0, 300, 60).map((p, i) => ({
      ...p,
      longitude: p.longitude + (i % 2 ? 3 : -3) / M_LNG,
    }));
    const back = line(0, 300, 0, 0, 60).map((p, i) => ({
      ...p,
      longitude: p.longitude + (i % 2 ? -3 : 3) / M_LNG,
    }));
    expect(areaOf([...out, ...back])).toBeNull();
  });

  it('claims nothing for standing still', () => {
    clock = 0;
    const jitter = Array.from({ length: 300 }, (_, i) => at((i % 3) - 1, ((i * 7) % 3) - 1));
    expect(areaOf(jitter)).toBeNull();
  });

  it('claims the bigger lobe of a figure of eight, not a cancelled-out area', () => {
    clock = 0;
    // Lobe A (radius 60) one way round, then lobe B (radius 90) the other way, both through the origin: a real 8.
    const lobeA = circle(60, 0, 60, 40, Math.PI);
    const lobeB = circle(-90, 0, 90, 60, 0).reverse();
    const area = areaOf([...lobeA, ...lobeB]);
    const bigger = Math.PI * 90 * 90;
    expect(area).toBeGreaterThan(bigger * 0.85);
    expect(area).toBeLessThan(bigger * 1.15);
  });

  it('claims both loops that merely touch at one point, as one track around two blocks', () => {
    clock = 0;
    const area = areaOf([...circle(60, 0, 60, 40, Math.PI), ...circle(-90, 0, 90, 60, 0)]);
    expect(area).toBeGreaterThan((Math.PI * 60 * 60 + Math.PI * 90 * 90) * 0.95);
  });

  it('claims only the loop that was closed in the middle of a longer run', () => {
    clock = 0;
    const approach = line(0, -500, 0, 0, 100);
    const loop = circle(100, 0, 100, 48, Math.PI);
    const area = areaOf([...approach, ...loop]);
    expect(area).toBeGreaterThan(Math.PI * 100 * 100 * 0.9);
    expect(area).toBeLessThan(Math.PI * 100 * 100 * 1.1);
  });

  it('claims nothing for a loop too small to be worth a territory', () => {
    clock = 0;
    const tiny = circle(0, 0, Math.sqrt(MIN_TERRITORY_AREA_M2 / Math.PI) * 0.6, 24);
    expect(areaOf(tiny)).toBeNull();
  });

  it('claims nothing for an impossibly large loop', () => {
    clock = 0;
    const huge = circle(0, 0, Math.sqrt((MAX_TERRITORY_AREA_M2 * 2) / Math.PI), 200);
    expect(areaOf(huge)).toBeNull();
  });

  it('claims nothing while the track is still open', () => {
    clock = 0;
    expect(areaOf(circle(0, 0, 100, 48).slice(0, 30))).toBeNull();
  });

  it('copes with an hour of one-second fixes without choking', () => {
    clock = 0;
    const track = Array.from({ length: 3600 }, (_, i) => {
      const a = (2 * Math.PI * i) / 3600;
      return at(500 * Math.cos(a) + (i % 2), 500 * Math.sin(a));
    });
    const started = Date.now();
    const area = areaOf([...track, track[0] as Location]);
    expect(Date.now() - started).toBeLessThan(500);
    expect(area).toBeGreaterThan(Math.PI * 500 * 500 * 0.9);
  });

  it('returns a ring that closes on itself, as [longitude, latitude] pairs', () => {
    clock = 0;
    const ring = territoryService.getEnclosedPolygon(circle(0, 0, 100));
    expect(ring).not.toBeNull();
    expect(ring?.[0]).toEqual(ring?.at(-1));
    expect(ring?.[0]?.[0]).toBeCloseTo(LNG + 100 / M_LNG, 3);
  });
});
