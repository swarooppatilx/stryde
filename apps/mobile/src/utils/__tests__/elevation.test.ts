import { describe, expect, it } from 'vitest';
import type { Location } from '@/types';
import {
  climbAndDescent,
  elevationProfile,
  smoothAltitudes,
  usableAltitudes,
} from '@/utils/elevation';

const ramp = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; step > 0 ? v <= to : v >= to; v += step) out.push(v);
  return out;
};

describe('climbAndDescent', () => {
  it('counts a steady climb in full', () => {
    expect(climbAndDescent(ramp(100, 150, 1))).toEqual({ gain: 50, loss: 0 });
  });

  it('counts a hill up and down', () => {
    const hill = [...ramp(100, 130, 1), ...ramp(129, 100, -1)];
    expect(climbAndDescent(hill)).toEqual({ gain: 30, loss: 30 });
  });

  it('ignores noise smaller than the bank threshold on a flat road', () => {
    const flat = Array.from({ length: 200 }, (_, i) => 100 + (i % 2 === 0 ? 3 : -3));
    expect(climbAndDescent(flat)).toEqual({ gain: 0, loss: 0 });
  });

  it('banks nothing for a rise under 8 m, however many times it repeats', () => {
    const rolling = Array.from(
      { length: 60 },
      (_, i) => 100 + (i % 12 < 6 ? i % 12 : 12 - (i % 12))
    );
    expect(climbAndDescent(rolling).gain).toBe(0);
  });

  it('still sees a climb that sits under noise', () => {
    const noisyClimb = ramp(0, 60, 1).map((v, i) => v + (i % 2 === 0 ? 1 : -1));
    const { gain } = climbAndDescent(noisyClimb);
    expect(gain).toBeGreaterThan(55);
    expect(gain).toBeLessThan(65);
  });

  it('counts each repeated climb, as a dip of 8 m or more starts a new one', () => {
    const saw = [...ramp(0, 10, 1), ...ramp(0, 10, 1), ...ramp(0, 10, 1)];
    expect(climbAndDescent(saw).gain).toBe(30);
  });

  it('counts the climb after a dip that is smaller than the threshold as one climb', () => {
    const climb = [...ramp(100, 130, 1), ...ramp(129, 124, -1), ...ramp(125, 140, 1)];
    expect(climbAndDescent(climb).gain).toBe(40);
  });

  it('counts the climb after a dip of 8 m or more on top of the first', () => {
    const climb = [...ramp(100, 130, 1), ...ramp(129, 118, -1), ...ramp(119, 135, 1)];
    expect(climbAndDescent(climb).gain).toBe(30 + 17);
  });

  it('resets on a jump between two samples of more than 10 m, counting neither way', () => {
    const spike = [...Array(5).fill(100), 112, ...Array(5).fill(100)];
    expect(climbAndDescent(spike)).toEqual({ gain: 0, loss: 0 });
  });

  it('can leave the jump rule off for a track thinned to fewer points', () => {
    const steep = [100, 112, 124, 136];
    expect(climbAndDescent(steep, { resetOnJump: false }).gain).toBe(36);
    expect(climbAndDescent(steep).gain).toBe(0);
  });

  it('has nothing for fewer than two points', () => {
    expect(climbAndDescent([])).toEqual({ gain: 0, loss: 0 });
    expect(climbAndDescent([120])).toEqual({ gain: 0, loss: 0 });
  });
});

describe('smoothAltitudes', () => {
  it('flattens a single spike but keeps the overall shape', () => {
    const values = [100, 100, 100, 130, 100, 100, 100];
    const smoothed = smoothAltitudes(values);
    expect(Math.max(...smoothed)).toBeLessThan(115);
    expect(smoothed).toHaveLength(values.length);
  });

  it('leaves a short series as it is', () => {
    expect(smoothAltitudes([1, 2])).toEqual([1, 2]);
  });
});

const fix = (altitude?: number, verticalAccuracy?: number): Location =>
  ({
    latitude: 0,
    longitude: 0,
    timestamp: 0,
    accuracy: 5,
    ...(altitude !== undefined && { altitude }),
    ...(verticalAccuracy !== undefined && { verticalAccuracy }),
  }) as Location;

describe('usableAltitudes', () => {
  it('takes the altitudes of fixes that have one and are trustworthy', () => {
    const fixes = [
      ...Array.from({ length: 12 }, (_, i) => fix(100 + i, 4)),
      fix(undefined),
      fix(300, 80),
    ];

    expect(usableAltitudes(fixes)).toEqual(Array.from({ length: 12 }, (_, i) => 100 + i));
  });

  it('is null when too few fixes carry an altitude to say anything', () => {
    expect(usableAltitudes([fix(100), fix(101)])).toBeNull();
    expect(usableAltitudes([fix(), fix(), fix()])).toBeNull();
  });
});

describe('elevationProfile', () => {
  const alt = [...ramp(100, 140, 1), ...ramp(139, 100, -1)];

  it('uses the stored climb and descent when the activity has them', () => {
    expect(elevationProfile({ alt }, 38, 41)).toEqual({
      elevations: alt,
      totalAscent: 38,
      totalDescent: 41,
      minElevation: 100,
      maxElevation: 140,
    });
  });

  it('works them out from the altitudes when none were stored', () => {
    const profile = elevationProfile({ alt });
    expect(profile?.totalAscent).toBe(40);
    expect(profile?.totalDescent).toBe(40);
  });

  it('is null without altitudes', () => {
    expect(elevationProfile({}, 10, 10)).toBeNull();
    expect(elevationProfile(undefined)).toBeNull();
    expect(elevationProfile({ alt: [100] })).toBeNull();
  });
});
