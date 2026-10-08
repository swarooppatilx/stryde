import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getActiveProfileId, setActiveProfileId } from '@/backends/activeProfile';
import {
  BOOT_GUARD_KEY,
  bootProfile,
  markBootHealthy,
  PROFILE_KEY,
  saveProfile,
} from '@/backends/boot';
import { type FakePlatform, installFakePlatform, uninstallFakePlatform } from '@/platform/fakes';
import type { StorageAdapter } from '@/platform/ports';

let platform: FakePlatform;

beforeEach(() => {
  platform = installFakePlatform();
});

afterEach(() => {
  setActiveProfileId('live');
  uninstallFakePlatform();
});

describe('bootProfile', () => {
  it('activates the stored profile in a development build', async () => {
    await platform.storage.setItem(PROFILE_KEY, 'local');

    await bootProfile({ storage: platform.storage, devToolsEnabled: true });

    expect(getActiveProfileId()).toBe('local');
  });

  it('opens on the default profile of the build on a fresh install', async () => {
    await bootProfile({
      storage: platform.storage,
      devToolsEnabled: true,
      defaultProfile: 'sandbox',
    });

    expect(getActiveProfileId()).toBe('sandbox');
  });

  it('never opens on a fake profile without developer tools', async () => {
    await bootProfile({
      storage: platform.storage,
      devToolsEnabled: false,
      defaultProfile: 'sandbox',
    });

    expect(getActiveProfileId()).toBe('live');
  });

  it('stays live when nothing is stored', async () => {
    await bootProfile({ storage: platform.storage, devToolsEnabled: true });

    expect(getActiveProfileId()).toBe('live');
  });

  it('does not even read storage outside a development build', async () => {
    await platform.storage.setItem(PROFILE_KEY, 'sandbox');
    let reads = 0;
    const counting: StorageAdapter = {
      getItem: async (key) => {
        reads++;
        return platform.storage.getItem(key);
      },
      setItem: (key, value) => platform.storage.setItem(key, value),
      removeItem: (key) => platform.storage.removeItem(key),
    };

    await bootProfile({ storage: counting, devToolsEnabled: false });

    expect(reads).toBe(0);
    expect(getActiveProfileId()).toBe('live');
  });

  it('survives storage failing, falling back to live', async () => {
    const broken: StorageAdapter = {
      getItem: async () => {
        throw new Error('disk');
      },
      setItem: async () => {},
      removeItem: async () => {},
    };

    await expect(bootProfile({ storage: broken, devToolsEnabled: true })).resolves.toBe('live');
  });
});

describe('saveProfile', () => {
  it('stores the choice for the next launch', async () => {
    await saveProfile(platform.storage, 'local');

    expect(platform.storage.peek(PROFILE_KEY)).toBe('local');
  });
});

describe('boot guard', () => {
  const boot = (storage: StorageAdapter) => bootProfile({ storage, devToolsEnabled: true });

  it('falls back to live when the last launch on a non-live profile never finished starting', async () => {
    await platform.storage.setItem(PROFILE_KEY, 'local');

    await boot(platform.storage);
    expect(getActiveProfileId()).toBe('local');

    // The app crashed before reaching a screen: no markBootHealthy. The next launch is rescued.
    setActiveProfileId('live');
    await boot(platform.storage);

    expect(getActiveProfileId()).toBe('live');
    expect(await platform.storage.getItem(PROFILE_KEY)).toBe('live');
  });

  it('keeps the profile when the last launch reached a screen', async () => {
    await platform.storage.setItem(PROFILE_KEY, 'local');
    await boot(platform.storage);
    await markBootHealthy(platform.storage);

    setActiveProfileId('live');
    await boot(platform.storage);

    expect(getActiveProfileId()).toBe('local');
  });

  it('never guards live', async () => {
    await boot(platform.storage);

    expect(await platform.storage.getItem(BOOT_GUARD_KEY)).toBeNull();
  });
});
