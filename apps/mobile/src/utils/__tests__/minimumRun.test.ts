import { describe, expect, it } from 'vitest';
import { isTooShort, MIN_GPS_DISTANCE_M } from '@/utils/minimumRun';

describe('isTooShort', () => {
  it('flags a GPS sport that has hardly moved', () => {
    expect(isTooShort('run', MIN_GPS_DISTANCE_M - 1)).toBe(true);
    expect(isTooShort('ride', 0)).toBe(true);
  });

  it('lets a run that has gone far enough be saved', () => {
    expect(isTooShort('run', MIN_GPS_DISTANCE_M)).toBe(false);
    expect(isTooShort('walk', 500)).toBe(false);
  });

  it('never flags a sport that is not measured by distance', () => {
    expect(isTooShort('strength' as never, 0)).toBe(false);
  });
});
