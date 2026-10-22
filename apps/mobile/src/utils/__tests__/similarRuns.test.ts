import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import { similarRuns, similarRunsText } from '@/utils/similarRuns';

// "lng,lat" points joined by ";", as saved activities carry them.
const START = '73.8500,18.5200';
const NEAR = '73.8510,18.5200'; // about 105 m from START
const FAR = '73.9000,18.6000'; // kilometres away

const act = (id: string, over: Partial<Activity> & { start?: string } = {}): Activity =>
  ({
    id,
    activityType: 'run',
    distance: 5000,
    duration: 1_500_000,
    polyline: `${over.start ?? START};73.8600,18.5300`,
    isManual: false,
    ...over,
  }) as Activity;

describe('similarRuns', () => {
  it('ranks a run among your own runs of the same sport that start in the same place and go about as far', () => {
    const mine = act('mine', { duration: 1_500_000 });
    const others = [
      act('slower', { duration: 1_650_000 }),
      act('faster', { duration: 1_400_000 }),
      act('near-start', { start: NEAR, duration: 1_800_000 }),
    ];

    expect(similarRuns(mine, [mine, ...others])).toEqual({ count: 4, rank: 2 });
  });

  it('leaves out other sports, far starts, very different distances and hand-entered runs', () => {
    const mine = act('mine');
    const others = [
      act('ride', { activityType: 'ride' }),
      act('far', { start: FAR }),
      act('long', { distance: 9000 }),
      act('typed', { isManual: true, duration: 600_000 }),
    ];

    expect(similarRuns(mine, [mine, ...others])).toBeNull();
  });

  it('says nothing for a run with no route, or a hand-entered one', () => {
    expect(similarRuns(act('none', { polyline: '' }), [act('x')])).toBeNull();
    expect(similarRuns(act('typed', { isManual: true }), [act('x')])).toBeNull();
  });

  it('is first when it is the quickest of its group', () => {
    const mine = act('mine', { duration: 1_000_000 });

    expect(similarRuns(mine, [mine, act('a'), act('b')])).toEqual({ count: 3, rank: 1 });
  });
});

describe('similarRunsText', () => {
  it('names the quickest and says where the others stand', () => {
    expect(similarRunsText({ count: 4, rank: 1 })).toBe('Your fastest of 4 similar runs');
    expect(similarRunsText({ count: 4, rank: 2 })).toBe('2nd fastest of 4 similar runs');
    expect(similarRunsText({ count: 2, rank: 2 })).toBe('2nd fastest of 2 similar runs');
  });
});
