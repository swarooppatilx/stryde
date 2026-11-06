import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useSegmentStarsStore, isStarred, starredList } = await import('@/stores/segmentStarsStore');

const lap = {
  key: '0xaaa',
  name: 'River lap',
  sportType: 0,
  start: { latitude: 18.5, longitude: 73.8 },
  end: { latitude: 18.51, longitude: 73.81 },
  distanceM: 1500,
};

beforeEach(() => {
  installFakePlatform();
  useSegmentStarsStore.getState().reset();
});

describe('segment stars store', () => {
  it('stars a segment and keeps what the list and map need', () => {
    useSegmentStarsStore.getState().toggle({ ...lap, extra: 'dropped' } as typeof lap);

    const { starred } = useSegmentStarsStore.getState();
    expect(isStarred(starred, '0xaaa')).toBe(true);
    expect(starred['0xaaa']).toEqual(lap);
  });

  it('toggles the star off again', () => {
    useSegmentStarsStore.getState().toggle(lap);
    useSegmentStarsStore.getState().toggle(lap);

    expect(starredList(useSegmentStarsStore.getState().starred)).toEqual([]);
  });

  it('unstars one segment and leaves the others', () => {
    useSegmentStarsStore.getState().toggle(lap);
    useSegmentStarsStore.getState().toggle({ ...lap, key: '0xbbb' });
    useSegmentStarsStore.getState().unstar('0xaaa');

    expect(starredList(useSegmentStarsStore.getState().starred).map((s) => s.key)).toEqual([
      '0xbbb',
    ]);
  });

  it('ignores unstarring a segment that was never starred', () => {
    const before = useSegmentStarsStore.getState().starred;
    useSegmentStarsStore.getState().unstar('0xnone');

    expect(useSegmentStarsStore.getState().starred).toBe(before);
  });

  it('forgets every star on reset, as when the account changes', () => {
    useSegmentStarsStore.getState().toggle(lap);
    useSegmentStarsStore.getState().reset();

    expect(useSegmentStarsStore.getState().starred).toEqual({});
  });
});
