import { describe, expect, it } from 'vitest';
import { CELEBRATIONS, SHORT_ACTIVITY_LINE } from '@/constants/copy';
import { celebrationFor, isShortActivity } from '@/utils/celebration';

describe('celebrationFor', () => {
  it('rotates through the lines as the athlete saves more activities', () => {
    const lines = [1, 2, 3, 4].map((n) => celebrationFor({ activityCount: n, short: false }));

    expect(new Set(lines).size).toBe(CELEBRATIONS.length);
    expect(celebrationFor({ activityCount: 5, short: false })).toBe(lines[0]);
  });

  it('gives the same line for the same count, so it does not change on a re-render', () => {
    expect(celebrationFor({ activityCount: 7, short: false })).toBe(
      celebrationFor({ activityCount: 7, short: false })
    );
  });

  it('says something kind about a short activity instead', () => {
    expect(celebrationFor({ activityCount: 3, short: true })).toBe(SHORT_ACTIVITY_LINE);
  });

  it('copes with a count of zero', () => {
    expect(CELEBRATIONS).toContain(celebrationFor({ activityCount: 0, short: false }));
  });
});

describe('isShortActivity', () => {
  it('is a GPS activity under a kilometre', () => {
    expect(isShortActivity({ distance: 600, duration: 300_000, activityType: 'run' })).toBe(true);
    expect(isShortActivity({ distance: 1000, duration: 300_000, activityType: 'run' })).toBe(false);
  });

  it('is a time-only activity under five minutes', () => {
    expect(isShortActivity({ distance: 0, duration: 240_000, activityType: 'yoga' })).toBe(true);
    expect(isShortActivity({ distance: 0, duration: 1_800_000, activityType: 'yoga' })).toBe(false);
  });
});
