import { describe, expect, it } from 'vitest';
import { createLatestGate, routeColorFor, visibleRoutes } from '@/utils/mapRoutes';

describe('createLatestGate', () => {
  it('lets only the newest request apply its answer', () => {
    const gate = createLatestGate();
    const first = gate.next();
    const second = gate.next();

    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  it('invalidates everything pending when cancelled (query cleared)', () => {
    const gate = createLatestGate();
    const pending = gate.next();

    gate.cancel();

    expect(pending.isCurrent()).toBe(false);
  });
});

describe('routeColorFor', () => {
  it('colours your own routes by sport, like everyone else’s', () => {
    expect(routeColorFor('ride')).toBe(routeColorFor('ride'));
    expect(routeColorFor('ride')).not.toBe(routeColorFor('run'));
  });

  it('falls back to a neutral grey for an unknown sport', () => {
    expect(routeColorFor(undefined)).toBe('#64748b');
    expect(routeColorFor('quidditch')).toBe('#64748b');
  });
});

describe('visibleRoutes', () => {
  const own = [{ id: 'mine' }];
  const others = [{ id: 'theirs' }];

  it('shows nothing when both layers are off', () => {
    expect(visibleRoutes({ showRoutes: false, showOthers: false, own, others })).toEqual([]);
  });

  it('shows your routes when only "my routes" is on', () => {
    expect(visibleRoutes({ showRoutes: true, showOthers: false, own, others })).toEqual(own);
  });

  it('shows other people’s routes when only "others" is on, without needing "my routes"', () => {
    expect(visibleRoutes({ showRoutes: false, showOthers: true, own, others })).toEqual(others);
  });

  it('shows both when both are on', () => {
    expect(visibleRoutes({ showRoutes: true, showOthers: true, own, others })).toEqual([
      ...own,
      ...others,
    ]);
  });
});
