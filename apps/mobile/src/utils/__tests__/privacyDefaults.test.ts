import { describe, expect, it } from 'vitest';
import {
  mapVisibilityOf,
  sanitizeHiddenStats,
  switchesForMapVisibility,
} from '@/utils/privacyDefaults';

describe('map visibility choice', () => {
  it('round-trips every choice through the stored switches', () => {
    for (const choice of ['show', 'ends', 'hide'] as const) {
      expect(mapVisibilityOf(switchesForMapVisibility(choice))).toBe(choice);
    }
  });

  it('reads an install that only had the route-ends switch on as that choice', () => {
    expect(mapVisibilityOf({ defaultHideRoute: false, hideRouteEnds: true })).toBe('ends');
  });

  it('keeps the ends hidden when the whole route is hidden', () => {
    expect(switchesForMapVisibility('hide')).toEqual({
      defaultHideRoute: true,
      hideRouteEnds: true,
    });
  });
});

describe('sanitizeHiddenStats', () => {
  it('keeps known stats once, in a fixed order', () => {
    expect(sanitizeHiddenStats(['pace', 'start_time', 'pace'])).toEqual(['start_time', 'pace']);
  });

  it('drops unknown values and non-lists', () => {
    expect(sanitizeHiddenStats(['heart_rate', 'pace'])).toEqual(['pace']);
    expect(sanitizeHiddenStats('pace')).toEqual([]);
    expect(sanitizeHiddenStats(undefined)).toEqual([]);
  });
});
