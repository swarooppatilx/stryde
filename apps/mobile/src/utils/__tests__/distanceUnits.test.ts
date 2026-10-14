import { describe, expect, it } from 'vitest';
import {
  distanceUnitLabel,
  metersPerDistanceUnit,
  parseDistanceMeters,
} from '@/utils/distanceUnits';

describe('distance units', () => {
  it("is a kilometre or a mile, by the athlete's unit setting", () => {
    expect(metersPerDistanceUnit('metric')).toBe(1000);
    expect(metersPerDistanceUnit('imperial')).toBe(1609.344);
    expect(distanceUnitLabel('metric')).toBe('km');
    expect(distanceUnitLabel('imperial')).toBe('mi');
  });

  it("reads what was typed in the athlete's unit as metres", () => {
    expect(parseDistanceMeters('50', 'metric')).toBe(50_000);
    expect(parseDistanceMeters('10', 'imperial')).toBe(16_093);
    expect(parseDistanceMeters('2.5', 'metric')).toBe(2500);
  });

  it('is zero for nothing usable', () => {
    expect(parseDistanceMeters('', 'metric')).toBe(0);
    expect(parseDistanceMeters('abc', 'imperial')).toBe(0);
    expect(parseDistanceMeters('-3', 'metric')).toBe(0);
  });
});
