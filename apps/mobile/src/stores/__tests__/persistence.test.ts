import { beforeEach, describe, expect, it } from 'vitest';
import { at, type FakePlatform, installFakePlatform } from '@/platform/fakes';
import { chainScopedStorageAdapter } from '@/utils/storage';

// Production order: entrypoint.js installs the platform, *then* stores load and
// start hydrating. A store imported before that would silently never hydrate.
installFakePlatform();
const { useActivityStore } = await import('@/stores/activityStore');

const saved = {
  state: {
    activities: [
      { id: 'a1', name: 'Night Run', createdAt: '2026-01-01T12:00:00.000Z', distance: 5000 },
    ],
  },
  version: 1,
};

let platform: FakePlatform;

beforeEach(() => {
  platform = installFakePlatform();
  useActivityStore.setState({ activities: [] });
});

describe('persisted stores read through the installed platform', () => {
  it('hydrates what an earlier launch saved, and revives dates', async () => {
    await chainScopedStorageAdapter.setItem('@stryde/activities', JSON.stringify(saved));

    await useActivityStore.persist.rehydrate();

    const activity = at(useActivityStore.getState().activities, 0);
    expect(activity.id).toBe('a1');
    expect(activity.createdAt).toBeInstanceOf(Date);
  });

  it('writes changes back, scoped to the active chain', async () => {
    useActivityStore.getState().setActivities([]);

    await Promise.resolve();

    expect(platform.storage.keys()).toHaveLength(1);
    expect(platform.storage.keys()[0]).toMatch(/:@stryde\/activities$/);
  });

  it('follows a newly installed platform without re-importing the store', async () => {
    await chainScopedStorageAdapter.setItem('@stryde/activities', JSON.stringify(saved));
    const before = platform.storage.keys();

    const second = installFakePlatform();

    expect(before).toHaveLength(1);
    expect(second.storage.keys()).toHaveLength(0);
    expect(await chainScopedStorageAdapter.getItem('@stryde/activities')).toBeNull();
  });
});
