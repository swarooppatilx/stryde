import { describe, expect, it } from 'vitest';
import {
  heatmapPoints,
  type LngLatPair,
  pointFeature,
  routeFeatureCollection,
  sampleRoute,
  territoryBoundsRing,
  territoryFeatureCollection,
} from '@/utils/mapData';

const line = (n: number): LngLatPair[] =>
  Array.from({ length: n }, (_, i) => [73 + i * 1e-4, 18 + i * 1e-4]);

describe('sampleRoute', () => {
  it('leaves a short route untouched', () => {
    const route = line(50);
    expect(sampleRoute(route, 400)).toBe(route);
  });

  it('thins a dense route but keeps both ends so the shape still starts and finishes right', () => {
    const route = line(5000);
    const sampled = sampleRoute(route, 400);

    expect(sampled.length).toBeLessThanOrEqual(401);
    expect(sampled.length).toBeGreaterThan(300);
    expect(sampled[0]).toEqual(route[0]);
    expect(sampled.at(-1)).toEqual(route.at(-1));
  });
});

describe('heatmapPoints', () => {
  it('collapses overlapping tracks into one point per grid cell', () => {
    const route = { id: 'a', color: '#000', coordinates: line(30) };
    const once = heatmapPoints([route]);
    const twice = heatmapPoints([route, { ...route, id: 'b' }]);

    expect(twice).toHaveLength(once.length);
  });

  it('never exceeds the total cap', () => {
    const routes = Array.from({ length: 50 }, (_, r) => ({
      id: String(r),
      color: '#000',
      coordinates: Array.from({ length: 200 }, (_, i): LngLatPair => [70 + r + i * 0.01, 10 + r]),
    }));

    expect(heatmapPoints(routes, 60, 4000, 100)).toHaveLength(100);
  });
});

describe('feature collections', () => {
  it('drops routes too short to draw a line', () => {
    const fc = routeFeatureCollection([
      { id: 'one', color: '#fff', coordinates: [[1, 1]] },
      { id: 'two', color: '#fff', coordinates: line(2) },
    ]);

    expect(fc.features.map((f) => f.properties.id)).toEqual(['two']);
  });

  it('tags each territory so a tap can resolve its owner', () => {
    const ring = territoryBoundsRing({ minLng: 0, minLat: 0, maxLng: 1, maxLat: 1 });
    const fc = territoryFeatureCollection([{ id: '0xabc', ring }]);

    expect(fc.features[0]?.properties).toEqual({ territoryId: '0xabc' });
    expect(fc.features[0]?.geometry).toEqual({ type: 'Polygon', coordinates: [ring] });
  });

  it('wraps a single point', () => {
    expect(pointFeature([1, 2]).features[0]?.geometry).toEqual({
      type: 'Point',
      coordinates: [1, 2],
    });
  });
});

describe('territoryBoundsRing', () => {
  it('is a closed ring inside its bounds', () => {
    const ring = territoryBoundsRing({ minLng: 73, minLat: 18, maxLng: 73.01, maxLat: 18.01 });

    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring.at(-1));
    for (const [lng, lat] of ring) {
      expect(lng).toBeGreaterThanOrEqual(73);
      expect(lng).toBeLessThanOrEqual(73.01);
      expect(lat).toBeGreaterThanOrEqual(18);
      expect(lat).toBeLessThanOrEqual(18.01);
    }
  });

  it('caps the inset so a huge territory still looks like its footprint', () => {
    const ring = territoryBoundsRing({ minLng: 0, minLat: 0, maxLng: 10, maxLat: 10 });

    expect(ring[0]?.[0]).toBeCloseTo(0.0015, 6);
  });
});
