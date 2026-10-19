import { describe, expect, it } from 'vitest';
import { puckFeatureCollection } from '@/utils/locationPuck';

describe('puckFeatureCollection', () => {
  it('is empty without a position', () => {
    expect(puckFeatureCollection(null).features).toEqual([]);
  });

  it('scales the accuracy to pixels at zoom 0 and carries the heading when known', () => {
    const [feature] = puckFeatureCollection({
      coordinate: [0, 0],
      accuracy: 78.271517,
      heading: 90,
    }).features;
    expect(feature?.properties?.accuracyPx).toBeCloseTo(0.001, 6);
    expect(feature?.properties?.heading).toBe(90);
  });

  it('leaves the heading out when unknown', () => {
    const [feature] = puckFeatureCollection({
      coordinate: [73, 18],
      accuracy: 10,
      heading: null,
    }).features;
    expect(feature?.properties).not.toHaveProperty('heading');
  });
});
