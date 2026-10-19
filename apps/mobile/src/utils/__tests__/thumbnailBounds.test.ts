import { describe, expect, it } from 'vitest';
import { fitBoundsToAspect } from '@/utils/thumbnailBounds';

const metersPerDegLat = 111_320;

/** Width and height in meters of a [minLng, minLat, maxLng, maxLat] box. */
function sizeM([minLng, minLat, maxLng, maxLat]: [number, number, number, number]) {
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  return {
    w: (maxLng - minLng) * metersPerDegLat * Math.cos(midLat),
    h: (maxLat - minLat) * metersPerDegLat,
  };
}

describe('fitBoundsToAspect', () => {
  it('widens a tall box until it has the picture’s shape, so a circle stays a circle', () => {
    const tall: [number, number, number, number] = [73.8, 18.5, 73.8005, 18.502];

    const fitted = fitBoundsToAspect(tall, 600 / 240);
    const { w, h } = sizeM(fitted);

    expect(w / h).toBeCloseTo(2.5, 2);
    // It still contains the original box.
    const slack = 1e-9;
    expect(fitted[0]).toBeLessThanOrEqual(tall[0] + slack);
    expect(fitted[2]).toBeGreaterThanOrEqual(tall[2] - slack);
    expect(fitted[1]).toBeLessThanOrEqual(tall[1] + slack);
    expect(fitted[3]).toBeGreaterThanOrEqual(tall[3] - slack);
  });

  it('heightens a wide box instead, keeping it centred', () => {
    const wide: [number, number, number, number] = [73.8, 18.5, 73.81, 18.5003];

    const fitted = fitBoundsToAspect(wide, 600 / 240);
    const { w, h } = sizeM(fitted);

    expect(w / h).toBeCloseTo(2.5, 2);
    expect((fitted[1] + fitted[3]) / 2).toBeCloseTo((wide[1] + wide[3]) / 2, 8);
    expect((fitted[0] + fitted[2]) / 2).toBeCloseTo((wide[0] + wide[2]) / 2, 8);
  });
});
