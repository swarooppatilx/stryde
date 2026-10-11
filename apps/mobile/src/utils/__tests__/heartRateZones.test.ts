import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ZONE_FLOORS,
  HEART_RATE_ZONES,
  MAX_READING_GAP_S,
  parseZoneFloors,
  reserveShare,
  sameFloors,
  timeInZones,
  zoneFloorsToTexts,
  zoneOf,
} from '@/utils/heartRateZones';

describe('zoneOf', () => {
  it('places a reading by its share of max heart rate', () => {
    expect(zoneOf(100, 200)).toBe(1); // 50%
    expect(zoneOf(120, 200)).toBe(2); // 60%
    expect(zoneOf(150, 200)).toBe(3); // 75%
    expect(zoneOf(170, 200)).toBe(4); // 85%
    expect(zoneOf(190, 200)).toBe(5); // 95%
    expect(zoneOf(210, 200)).toBe(5); // above max stays in the top zone
  });
});

describe('timeInZones', () => {
  const max = 200;

  it('has five zones in order', () => {
    expect(HEART_RATE_ZONES.map((z) => z.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('adds up the seconds each reading lasted until the next', () => {
    const result = timeInZones({ t: [0, 60, 120, 180], bpm: [110, 150, 150, 190] }, max);

    expect(result.map((z) => z.seconds)).toEqual([60, 0, 120, 0, 60]);
  });

  it('gives the last reading the gap before it, so the end of a run is not lost', () => {
    const result = timeInZones({ t: [0, 60], bpm: [110, 190] }, max);

    expect(result[0]?.seconds).toBe(60);
    expect(result[4]?.seconds).toBe(60);
  });

  it('does not count a long dropout as time in a zone', () => {
    const result = timeInZones({ t: [0, 1000], bpm: [110, 110] }, max);

    expect(result[0]?.seconds).toBe(MAX_READING_GAP_S * 2);
  });

  it('gives each zone its share of the time measured', () => {
    const result = timeInZones({ t: [0, 30, 60], bpm: [110, 150, 150] }, max);

    expect(result[0]?.share).toBeCloseTo(1 / 3, 5);
    expect(result[2]?.share).toBeCloseTo(2 / 3, 5);
  });

  it('is empty with no readings, no max, or a mismatched series', () => {
    expect(timeInZones({ t: [], bpm: [] }, max)).toEqual([]);
    expect(timeInZones({ t: [0, 1], bpm: [100, 100] }, 0)).toEqual([]);
    expect(timeInZones({ t: [0, 1], bpm: [100] }, max)).toEqual([]);
  });

  it('skips readings that are not a believable heart rate', () => {
    const result = timeInZones({ t: [0, 10, 20], bpm: [0, 150, 150] }, max);

    expect(result.reduce((sum, z) => sum + z.seconds, 0)).toBe(20);
  });
});

describe('with a resting heart rate', () => {
  it('measures effort as a share of the reserve between resting and maximum', () => {
    expect(reserveShare(120, 200, 60)).toBeCloseTo(60 / 140, 5);
    expect(reserveShare(60, 200, 60)).toBe(0);
  });

  it('ignores a resting figure that is not below the maximum', () => {
    expect(reserveShare(100, 200, 200)).toBe(0.5);
    expect(reserveShare(100, 200, undefined)).toBe(0.5);
  });

  it('puts the same reading in a higher zone, since a low resting rate widens the effort', () => {
    // 150 of 200 is 75% of max (zone 3) but 65% of the reserve above a 50 bpm rest (zone 2 is 60 to 70).
    expect(zoneOf(150, 200)).toBe(3);
    expect(zoneOf(150, 200, 50)).toBe(2);
    expect(zoneOf(165, 200, 50)).toBe(3);
  });

  it('is used when times are added up', () => {
    const result = timeInZones({ t: [0, 60], bpm: [150, 150] }, 200, 50);

    expect(result[1]?.seconds).toBe(120);
  });
});

describe('custom zone boundaries', () => {
  // Zone 5 only from 96 percent, and an easier zone 2 from 50.
  const floors = [0.5, 0.65, 0.8, 0.96] as const;

  it("uses the athlete's own boundaries to place a reading", () => {
    // 190 of 200 is 95 percent: zone 5 by default (from 90), zone 4 with these boundaries.
    expect(zoneOf(190, 200, undefined, DEFAULT_ZONE_FLOORS)).toBe(5);
    expect(zoneOf(190, 200, undefined, floors)).toBe(4);
    // 105 of 200 is 52.5 percent: recovery by default (zone 2 from 60), zone 2 here.
    expect(zoneOf(105, 200, undefined, DEFAULT_ZONE_FLOORS)).toBe(1);
    expect(zoneOf(105, 200, undefined, floors)).toBe(2);
  });

  it('adds up time by those boundaries', () => {
    const result = timeInZones({ t: [0, 60], bpm: [190, 190] }, 200, undefined, floors);

    expect(result[3]?.seconds).toBe(120);
    expect(result[4]?.seconds).toBe(0);
  });
});

describe('parseZoneFloors', () => {
  it('reads four percentages that go up', () => {
    expect(parseZoneFloors(['55', '65', '78', '92'])).toEqual([0.55, 0.65, 0.78, 0.92]);
  });

  it('is null when one is missing, not a whole number, or out of range', () => {
    expect(parseZoneFloors(['55', '65', '78', ''])).toBeNull();
    expect(parseZoneFloors(['55', '65.5', '78', '92'])).toBeNull();
    expect(parseZoneFloors(['20', '65', '78', '92'])).toBeNull();
    expect(parseZoneFloors(['55', '65', '78', '100'])).toBeNull();
  });

  it('is null when they do not rise, since a zone would have no room', () => {
    expect(parseZoneFloors(['55', '65', '65', '92'])).toBeNull();
    expect(parseZoneFloors(['70', '60', '80', '90'])).toBeNull();
  });
});

describe('zoneFloorsToTexts and sameFloors', () => {
  it('writes the usual boundaries when none were chosen, as whole percentages', () => {
    expect(zoneFloorsToTexts(undefined)).toEqual(['60', '70', '80', '90']);
    expect(zoneFloorsToTexts([0.55, 0.65, 0.78, 0.92])).toEqual(['55', '65', '78', '92']);
  });

  it('knows the usual boundaries when it sees them, even with float noise', () => {
    expect(sameFloors([0.6, 0.7, 0.8, 0.9], DEFAULT_ZONE_FLOORS)).toBe(true);
    expect(sameFloors([0.6, 0.7, 0.8, 0.91], DEFAULT_ZONE_FLOORS)).toBe(false);
  });
});
