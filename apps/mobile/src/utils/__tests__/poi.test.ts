import { describe, expect, it } from 'vitest';
import { distanceTo, etaMs, poiFromFeature, poiIcon } from '@/utils/poi';

describe('poiFromFeature', () => {
  it('reads name, kind and position from a Mapbox place label', () => {
    expect(
      poiFromFeature({
        geometry: { type: 'Point', coordinates: [73.85, 18.52] },
        properties: { name: 'Blue Tokai', type: 'Cafe', maki: 'cafe', class: 'food_and_drink' },
      })
    ).toEqual({ name: 'Blue Tokai', kind: 'Cafe', maki: 'cafe', coordinate: [73.85, 18.52] });
  });

  it('falls back to the class for the kind', () => {
    expect(
      poiFromFeature({
        geometry: { type: 'Point', coordinates: [1, 2] },
        properties: { name: 'Fountain', class: 'drinking_water' },
      })?.kind
    ).toBe('Drinking Water');
  });

  it('ignores labels without a name or a point', () => {
    expect(
      poiFromFeature({ geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} })
    ).toBeNull();
    expect(
      poiFromFeature({
        geometry: { type: 'LineString', coordinates: [] },
        properties: { name: 'x' },
      })
    ).toBeNull();
  });
});

describe('poiIcon', () => {
  it('maps athlete-relevant places and falls back to a pin', () => {
    expect(poiIcon('drinking-water')).toBe('water-outline');
    expect(poiIcon('unknown-thing')).toBe('location-outline');
  });
});

describe('distance and arrival', () => {
  it('measures the straight line and pads it for winding paths', () => {
    const poi = { name: 'x', kind: 'x', maki: '', coordinate: [73.86, 18.52] as [number, number] };
    const d = distanceTo({ latitude: 18.52, longitude: 73.85 }, poi);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1100);
    // 1 km at running speed (2.8 m/s), stretched by a fifth.
    expect(Math.round(etaMs(1000, 'run') / 1000)).toBe(429);
    expect(etaMs(1000, 'ride')).toBeLessThan(etaMs(1000, 'run'));
  });
});
