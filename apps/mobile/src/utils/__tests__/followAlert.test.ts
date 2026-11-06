import { describe, expect, it } from 'vitest';
import { FRESH_FOLLOW_STATE, followAlertText, stepFollowAlert } from '@/utils/followAlert';
import type { RoutePoint } from '@/utils/route';

const LINE: RoutePoint[] = [
  [0, 0],
  [0.009, 0],
];

describe('stepFollowAlert', () => {
  it('alerts once on leaving and once on rejoining', () => {
    let state = FRESH_FOLLOW_STATE;
    const step = (p: RoutePoint) => {
      const r = stepFollowAlert(state, p, LINE);
      state = r.state;
      return r.alert;
    };
    expect(step([0.001, 0])).toBeNull();
    // ~110 m north of the line.
    expect(step([0.002, 0.001])).toBe('off');
    expect(step([0.003, 0.001])).toBeNull();
    expect(step([0.004, 0])).toBe('back');
    expect(state.lastAlongM).toBeGreaterThan(400);
  });
});

describe('followAlertText', () => {
  it('names the route', () => {
    expect(followAlertText('off', 'River loop').body).toContain('River loop');
  });
});
