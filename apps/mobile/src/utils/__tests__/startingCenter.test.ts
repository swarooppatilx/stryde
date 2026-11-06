import { describe, expect, it } from 'vitest';
import { startingCenter } from '../startingCenter';

const FALLBACK: [number, number] = [73.85, 18.52];

describe('startingCenter', () => {
  it('uses the current location when there is one', () => {
    expect(
      startingCenter(
        { latitude: 51.5, longitude: -0.12 },
        [{ polyline: '2.35,48.85;2.36,48.86' }],
        FALLBACK
      )
    ).toEqual([-0.12, 51.5]);
  });

  it('falls back to where the latest activity started', () => {
    expect(
      startingCenter(null, [{ polyline: '2.35,48.85;2.36,48.86' }, { polyline: '9,9' }], FALLBACK)
    ).toEqual([2.35, 48.85]);
  });

  it('skips activities with no route', () => {
    expect(startingCenter(null, [{ polyline: '' }, { polyline: '2.35,48.85' }], FALLBACK)).toEqual([
      2.35, 48.85,
    ]);
  });

  it('uses the default when there is nothing else', () => {
    expect(startingCenter(null, [], FALLBACK)).toEqual(FALLBACK);
    expect(startingCenter(null, [{ polyline: '' }], FALLBACK)).toEqual(FALLBACK);
  });
});
