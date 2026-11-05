import { describe, expect, it } from 'vitest';
import type { ActivityType } from '@/types';
import { activeFilterCount, filterSavedRoutes, routeSportOptions } from '@/utils/routeLibrary';

const r = (id: string, sport: ActivityType, distance: number, starred = false) => ({
  id,
  sport,
  distance,
  starred,
});

const routes = [r('a', 'run', 3000), r('b', 'ride', 20_000, true), r('c', 'run', 10_000)];

describe('filterSavedRoutes', () => {
  it('lists starred routes first and keeps the order otherwise', () => {
    const out = filterSavedRoutes(routes, { sport: 'all', distance: 'any', starredOnly: false });
    expect(out.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('filters by sport, distance band and star', () => {
    expect(
      filterSavedRoutes(routes, { sport: 'run', distance: 'any', starredOnly: false }).map(
        (x) => x.id
      )
    ).toEqual(['a', 'c']);
    expect(
      filterSavedRoutes(routes, { sport: 'all', distance: 'medium', starredOnly: false }).map(
        (x) => x.id
      )
    ).toEqual(['c']);
    expect(
      filterSavedRoutes(routes, { sport: 'all', distance: 'any', starredOnly: true }).map(
        (x) => x.id
      )
    ).toEqual(['b']);
  });
});

describe('routeSportOptions', () => {
  it('offers only sports that have a saved route, after All', () => {
    expect(routeSportOptions(routes).map((o) => o.value)).toEqual(['all', 'run', 'ride']);
  });
});

describe('filterSavedRoutes by climb and difficulty', () => {
  const climb = (id: string, distance: number, elevationGain?: number) => ({
    id,
    sport: 'run' as ActivityType,
    distance,
    starred: false,
    elevationGain,
  });
  const set = [climb('flat', 5_000, 10), climb('hill', 10_000, 400), climb('unknown', 5_000)];
  const base = { sport: 'all', distance: 'any' as const, starredOnly: false };

  it('narrows by total climb and drops routes with no climb on record', () => {
    expect(filterSavedRoutes(set, { ...base, elevation: 'hilly' }).map((x) => x.id)).toEqual([
      'hill',
    ]);
    expect(filterSavedRoutes(set, { ...base, elevation: 'flat' }).map((x) => x.id)).toEqual([
      'flat',
    ]);
  });

  it('narrows by difficulty', () => {
    expect(filterSavedRoutes(set, { ...base, difficulty: 'hard' }).map((x) => x.id)).toEqual([
      'hill',
    ]);
    expect(filterSavedRoutes(set, { ...base, difficulty: 'easy' }).map((x) => x.id)).toEqual([
      'flat',
    ]);
  });

  it('keeps routes with an unknown climb when neither filter is set', () => {
    expect(filterSavedRoutes(set, base).map((x) => x.id)).toContain('unknown');
  });
});

describe('activeFilterCount', () => {
  const none = { sport: 'all', distance: 'any' as const, starredOnly: false };

  it('is zero when nothing narrows the list', () => {
    expect(activeFilterCount(none)).toBe(0);
  });

  it('counts each narrowed dimension once, ignoring the star toggle that has its own chip', () => {
    expect(
      activeFilterCount({
        ...none,
        sport: 'run',
        distance: 'long',
        elevation: 'hilly',
        difficulty: 'hard',
        starredOnly: true,
      })
    ).toBe(4);
  });

  it('treats an omitted elevation or difficulty as not narrowed', () => {
    expect(activeFilterCount({ ...none, sport: 'ride' })).toBe(1);
  });
});
