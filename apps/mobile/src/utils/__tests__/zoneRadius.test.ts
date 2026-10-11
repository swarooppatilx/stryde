import { describe, expect, it } from 'vitest';
import { stepZoneRadius } from '@/utils/zoneRadius';

describe('stepZoneRadius', () => {
  it('moves up and down in 200 m steps', () => {
    expect(stepZoneRadius(400, 1)).toBe(600);
    expect(stepZoneRadius(400, -1)).toBe(200);
  });

  it('stops at the smallest and the largest radius', () => {
    expect(stepZoneRadius(200, -1)).toBe(200);
    expect(stepZoneRadius(1600, 1)).toBe(1600);
  });

  it('brings a stored radius that is off the grid onto it', () => {
    expect(stepZoneRadius(500, 1)).toBe(600);
    expect(stepZoneRadius(500, -1)).toBe(400);
  });
});
