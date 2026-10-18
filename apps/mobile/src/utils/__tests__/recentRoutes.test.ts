import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import { recentRoutes } from '@/utils/recentRoutes';

const make = (id: string, polyline: string | undefined, distance = 5000): Activity =>
  ({ id, polyline, distance, activityType: 'run' }) as Activity;

const LINE = '73.85,18.52;73.86,18.53';

describe('recentRoutes', () => {
  it('keeps activities that have a drawable line, in the order given', () => {
    const list = [make('a', LINE), make('b', undefined), make('c', LINE)];

    expect(recentRoutes(list, 5).map((a) => a.id)).toEqual(['a', 'c']);
  });

  it('skips a single point and an empty line, which draw nothing', () => {
    const list = [make('dot', '73.85,18.52'), make('empty', ''), make('ok', LINE)];

    expect(recentRoutes(list, 5).map((a) => a.id)).toEqual(['ok']);
  });

  it('skips activities too short to be real, like a mis-tap', () => {
    const list = [make('tiny', LINE, 4), make('ok', LINE, 800)];

    expect(recentRoutes(list, 5).map((a) => a.id)).toEqual(['ok']);
  });

  it('returns at most the limit', () => {
    const list = ['a', 'b', 'c', 'd'].map((id) => make(id, LINE));

    expect(recentRoutes(list, 2).map((a) => a.id)).toEqual(['a', 'b']);
  });
});
