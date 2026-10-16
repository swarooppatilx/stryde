import { describe, expect, it } from 'vitest';
import { eventCoverColor, NEUTRAL_ROUTE_COLOR, SPORT_ROUTE_COLORS } from '@/constants/sportColors';

describe('eventCoverColor', () => {
  it('takes the sport colour for a single-sport event', () => {
    expect(eventCoverColor('ride')).toBe(SPORT_ROUTE_COLORS.ride);
  });

  it('stays neutral for a multi-sport event', () => {
    expect(eventCoverColor('multi')).toBe(NEUTRAL_ROUTE_COLOR);
  });
});
