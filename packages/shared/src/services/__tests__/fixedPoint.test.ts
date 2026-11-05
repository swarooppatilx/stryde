import { describe, expect, it } from 'vitest';
import { fromFixedPoint, toFixedPoint } from '../fixedPoint';

describe('fixed point degrees', () => {
  it('stores degrees as millionths, rounded to a whole number', () => {
    expect(toFixedPoint(73.851074)).toBe(73_851_074);
    expect(toFixedPoint(-18.5242091)).toBe(-18_524_209);
    expect(toFixedPoint(0)).toBe(0);
  });

  it('reads them back as degrees', () => {
    expect(fromFixedPoint(73_851_074)).toBeCloseTo(73.851074, 6);
    expect(fromFixedPoint(-18_524_209)).toBeCloseTo(-18.524209, 6);
  });

  it('survives the round trip for a coordinate with up to six decimals', () => {
    for (const degrees of [18.524209, -73.851074, 0.000001, 179.999999]) {
      expect(fromFixedPoint(toFixedPoint(degrees))).toBeCloseTo(degrees, 6);
    }
  });

  it('keeps a whole-world coordinate inside a 32-bit integer', () => {
    expect(toFixedPoint(180)).toBeLessThan(2 ** 31);
    expect(toFixedPoint(-180)).toBeGreaterThan(-(2 ** 31));
  });
});
