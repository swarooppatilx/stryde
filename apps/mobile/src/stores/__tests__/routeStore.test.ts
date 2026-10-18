import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useRouteStore } = await import('@/stores/routeStore');

const loop = {
  name: '  Riverside loop ',
  polyline: '73.85,18.52;73.86,18.53',
  distance: 5000,
  sport: 'run' as const,
};

beforeEach(() => {
  installFakePlatform();
  useRouteStore.getState().reset();
});

describe('route store', () => {
  it('saves a route under a trimmed name', () => {
    const route = useRouteStore.getState().save(loop);

    expect(route).toMatchObject({ name: 'Riverside loop', distance: 5000, sport: 'run' });
    expect(useRouteStore.getState().routes).toEqual([route]);
  });

  it('keeps one copy of the same line however often it is saved', () => {
    const first = useRouteStore.getState().save(loop);
    const again = useRouteStore.getState().save({ ...loop, name: 'Other name' });

    expect(again).toBe(first);
    expect(useRouteStore.getState().routes).toHaveLength(1);
  });

  it('lists the newest first', () => {
    useRouteStore.getState().save(loop);
    const second = useRouteStore.getState().save({ ...loop, polyline: '1,2;3,4', name: 'Hill' });

    expect(useRouteStore.getState().routes[0]).toBe(second);
  });

  it('removes a route', () => {
    const route = useRouteStore.getState().save(loop);

    useRouteStore.getState().remove(route.id);

    expect(useRouteStore.getState().routes).toEqual([]);
  });

  it('knows whether a line is saved', () => {
    expect(useRouteStore.getState().isSaved(loop.polyline)).toBe(false);

    useRouteStore.getState().save(loop);

    expect(useRouteStore.getState().isSaved(loop.polyline)).toBe(true);
  });
});
