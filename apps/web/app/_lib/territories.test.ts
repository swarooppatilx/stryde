import { describe, expect, it } from 'vitest';
import { type TerritoryRow, toFeatureCollection } from './territories';

const row = (overrides: Partial<TerritoryRow> = {}): TerritoryRow => ({
  id: '0xabc',
  area: '12000',
  // The registry stores degrees x 1e6.
  minLng: 73_851_074,
  minLat: 18_524_209,
  maxLng: 73_861_074,
  maxLat: 18_534_209,
  owner: { id: '0xowner', username: 'asha' },
  ...overrides,
});

describe('toFeatureCollection', () => {
  it('draws each territory as a closed rectangle in degrees, not fixed-point integers', () => {
    const { features } = toFeatureCollection([row()]);

    const ring = features[0]?.geometry.coordinates[0];
    expect(ring).toHaveLength(5);
    expect(ring?.[0]).toEqual(ring?.[4]);
    expect(ring?.[0]).toEqual([73.851074, 18.524209]);
    expect(ring?.[2]).toEqual([73.861074, 18.534209]);
  });

  it('keeps what a tooltip needs: owner, area and id', () => {
    const [feature] = toFeatureCollection([row()]).features;

    expect(feature?.properties).toEqual({ id: '0xabc', area: 12000, owner: 'asha' });
  });

  it('skips a territory the index has no bounds for (all zero)', () => {
    const collection = toFeatureCollection([
      row({ minLng: 0, minLat: 0, maxLng: 0, maxLat: 0 }),
      row({ id: '0xdef' }),
    ]);

    expect(collection.features.map((f) => f.properties.id)).toEqual(['0xdef']);
  });

  it('is an empty collection when there is no territory yet', () => {
    expect(toFeatureCollection([])).toEqual({ type: 'FeatureCollection', features: [] });
  });
});
