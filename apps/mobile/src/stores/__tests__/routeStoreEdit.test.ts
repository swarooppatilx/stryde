import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useRouteStore } = await import('@/stores/routeStore');

const loop = { name: 'Loop', polyline: '1,2;3,4', distance: 5000, sport: 'run' as const };

beforeEach(() => {
  installFakePlatform();
  useRouteStore.getState().reset();
});

describe('route store editing', () => {
  it('renames to a trimmed name and ignores an empty one', () => {
    const { id } = useRouteStore.getState().save(loop);
    useRouteStore.getState().rename(id, '  Hill  ');
    expect(useRouteStore.getState().routes[0]?.name).toBe('Hill');
    useRouteStore.getState().rename(id, '   ');
    expect(useRouteStore.getState().routes[0]?.name).toBe('Hill');
  });

  it('stars and unstars', () => {
    const { id } = useRouteStore.getState().save(loop);
    useRouteStore.getState().toggleStar(id);
    expect(useRouteStore.getState().routes[0]?.starred).toBe(true);
    useRouteStore.getState().toggleStar(id);
    expect(useRouteStore.getState().routes[0]?.starred).toBe(false);
  });
});
