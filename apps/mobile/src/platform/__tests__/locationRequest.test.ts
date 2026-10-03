import { describe, expect, it } from 'vitest';
import { locationRequestFor } from '@/platform/locationRequest';

describe('locationRequestFor', () => {
  it('asks for a fix about every second in best-accuracy mode', () => {
    expect(locationRequestFor('best')).toEqual({ timeIntervalMs: 1000, distanceIntervalM: 1 });
  });

  it('keeps five seconds between fixes when saving power or balancing', () => {
    expect(locationRequestFor('balanced')).toEqual({ timeIntervalMs: 5000, distanceIntervalM: 1 });
    expect(locationRequestFor('power')).toEqual({ timeIntervalMs: 5000, distanceIntervalM: 1 });
  });
});
