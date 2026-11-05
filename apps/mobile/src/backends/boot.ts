import type { StorageAdapter } from '@/platform/ports';
import { logger } from '@/utils/logger';
import { setActiveProfileId, trackBoot } from './activeProfile';
import { DEFAULT_PROFILE, type ProfileId, resolveProfile } from './profiles';

/** Unscoped on purpose: the choice has to be readable before any profile's own data. */
export const PROFILE_KEY = '@stryde/dev-profile';
/** Present while a non-live launch has not yet reached a screen. If it is still there at the next launch, that launch crashed. */
export const BOOT_GUARD_KEY = '@stryde/dev-profile-booting';

/**
 * Reads the developer's profile choice and activates it. Started before the router loads; the
 * chain-scoped storage and the root layout both wait for it (`whenProfileReady`).
 */
export function bootProfile(options: {
  storage: StorageAdapter;
  devToolsEnabled: boolean;
  /** The profile a fresh install opens on; Live unless the build says otherwise. */
  defaultProfile?: ProfileId;
}): Promise<ProfileId> {
  return trackBoot(loadProfile(options));
}

async function loadProfile({
  storage,
  devToolsEnabled,
  defaultProfile,
}: {
  storage: StorageAdapter;
  devToolsEnabled: boolean;
  defaultProfile?: ProfileId;
}): Promise<ProfileId> {
  let stored: string | null = null;
  if (devToolsEnabled) {
    try {
      stored = await storage.getItem(PROFILE_KEY);
    } catch {
      stored = null;
    }
  }
  let id = resolveProfile({ stored, devToolsEnabled, fallback: defaultProfile });
  if (devToolsEnabled && id !== DEFAULT_PROFILE) id = await guardBoot(storage, id);
  setActiveProfileId(id);
  return id;
}

/** Remembers the choice; it takes effect on the next launch. */
export async function saveProfile(storage: StorageAdapter, id: ProfileId): Promise<void> {
  await storage.setItem(PROFILE_KEY, id);
}

/**
 * Marks a non-live launch as in progress. If the mark is already there, the last launch with this
 * profile never got as far as a screen, so go back to live instead of crashing on a loop with no
 * way into the screen that switches profiles.
 */
async function guardBoot(storage: StorageAdapter, id: ProfileId): Promise<ProfileId> {
  try {
    if ((await storage.getItem(BOOT_GUARD_KEY)) === id) {
      await storage.removeItem(BOOT_GUARD_KEY);
      await storage.setItem(PROFILE_KEY, DEFAULT_PROFILE);
      logger.warn(`[Boot] The last launch on the ${id} profile did not finish; back to live`);
      return DEFAULT_PROFILE;
    }
    await storage.setItem(BOOT_GUARD_KEY, id);
  } catch {
    // A guard that cannot be saved must not stop the app starting.
  }
  return id;
}

/** The app reached a screen on this profile: the launch counts as good. */
export async function markBootHealthy(storage: StorageAdapter): Promise<void> {
  try {
    await storage.removeItem(BOOT_GUARD_KEY);
  } catch {
    // Nothing to do: the worst case is one unnecessary fall back to live.
  }
}
