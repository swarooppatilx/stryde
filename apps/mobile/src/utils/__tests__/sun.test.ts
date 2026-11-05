import { describe, expect, it } from 'vitest';
import { isAfterDark, solarElevation } from '@/utils/sun';

// Pune, India (UTC+5:30).
const PUNE = { lat: 18.52, lng: 73.86 };
const ist = (iso: string) => Date.parse(`${iso}+05:30`);

describe('solarElevation', () => {
  it('puts the sun high at local noon and below the horizon at midnight', () => {
    expect(solarElevation(ist('2026-06-21T12:30:00'), PUNE.lat, PUNE.lng)).toBeGreaterThan(80);
    expect(solarElevation(ist('2026-06-21T00:30:00'), PUNE.lat, PUNE.lng)).toBeLessThan(-40);
  });
});

describe('isAfterDark', () => {
  it('counts an early morning run before sunrise as night', () => {
    // Sunrise in Pune in early January is about 07:10.
    expect(isAfterDark(ist('2026-01-05T06:15:00'), PUNE.lat, PUNE.lng)).toBe(true);
    expect(isAfterDark(ist('2026-01-05T08:00:00'), PUNE.lat, PUNE.lng)).toBe(false);
  });

  it('counts an evening run after sunset as night', () => {
    // Sunset in Pune in late June is about 19:15.
    expect(isAfterDark(ist('2026-06-25T18:30:00'), PUNE.lat, PUNE.lng)).toBe(false);
    expect(isAfterDark(ist('2026-06-25T20:00:00'), PUNE.lat, PUNE.lng)).toBe(true);
  });

  it('knows the midnight sun', () => {
    // Tromsø at midnight in late June: the sun never sets.
    expect(isAfterDark(Date.parse('2026-06-25T22:00:00Z'), 69.65, 18.96)).toBe(false);
  });
});
