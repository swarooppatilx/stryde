import { describe, expect, it } from 'vitest';
import {
  segmentFromTrack as sharedFromTrack,
  encodeGeohash as sharedGeohash,
  matchSegmentEffort as sharedMatch,
} from '../../../../shared/src/segments';
import { encodeGeohash, matchSegmentEffort, segmentFromTrack } from '../fitness/index.js';

/** The app matches live with the shared copy; the server scores with this package's. They must agree. */
describe('shared segment geometry matches the API copy', () => {
  const run = Array.from({ length: 80 }, (_, i) => ({
    latitude: 19.076 + i * 0.000324,
    longitude: 72.8777 + Math.sin(i / 7) * 0.00002,
    timestamp: 1_700_000_000_000 + i * (9_000 + (i % 5) * 400),
  }));

  it('builds the same segment and finds the same effort', () => {
    for (const [from, to] of [
      [5, 40],
      [20, 70],
      [0, 79],
    ] as const) {
      const slice = run.slice(from, to);
      expect(sharedFromTrack(slice)).toEqual(segmentFromTrack(slice));
      const segment = segmentFromTrack(slice);
      if (!segment) throw new Error('segment');
      expect(sharedMatch(run, segment)).toEqual(matchSegmentEffort(run, segment));
    }
  });

  it('encodes the same geohash', () => {
    for (const [lat, lng] of [
      [19.076, 72.8777],
      [-33.86, 151.2],
      [64.1, -21.9],
    ] as const) {
      expect(sharedGeohash(lat, lng, 7)).toBe(encodeGeohash(lat, lng, 7));
    }
  });
});
