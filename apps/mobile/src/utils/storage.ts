import { getChainConfig } from '@repo/shared';
import { activeChainMode, getActiveProfileId, whenProfileReady } from '@/backends/activeProfile';
import type { StorageAdapter } from '@/platform/ports';
import { platformStorage, scopedStorage } from '@/platform/storage';

export type { StorageAdapter };

/** App-wide storage (settings, an in-progress run), backed by the installed platform. */
export const asyncStorageAdapter: StorageAdapter = platformStorage;

/** JSON has no Date type: revive ISO strings as Dates so fields typed `Date` (e.g. `Activity.createdAt`) are truthful at runtime. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isoDateReviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) {
    return new Date(value);
  }
  return value;
}

/** Keys scoped to the chain mode and deployment (ProfileRegistry address), so on-chain-derived data for one network, deploy or developer profile never shows under another. App-wide state (settings, an in-progress run) uses the unscoped adapter above. */
function chainScope(): string {
  // Read from env and shared config, not @/constants/config, so this module stays free of react-native imports and testable.
  const mode = activeChainMode(process.env.EXPO_PUBLIC_CHAIN_MODE);
  const profileRegistry = getChainConfig(mode).contracts.profileRegistry.toLowerCase();
  const scope = `${mode}:${profileRegistry}`;
  // Live keeps the keys it has always had; every other profile gets its own, since sandbox and
  // local both run in `local` mode and must not see each other's data.
  const profile = getActiveProfileId();
  return profile === 'live' ? scope : `${profile}:${scope}`;
}

const scoped = scopedStorage(platformStorage, chainScope);

/**
 * Stores start reading as soon as their module loads, which can be before the developer profile
 * has been read from disk. Every call waits for it, so each one lands in the profile's own scope.
 */
export const chainScopedStorageAdapter: StorageAdapter = {
  getItem: async (key) => {
    await whenProfileReady();
    return scoped.getItem(key);
  },
  setItem: async (key, value) => {
    await whenProfileReady();
    return scoped.setItem(key, value);
  },
  removeItem: async (key) => {
    await whenProfileReady();
    return scoped.removeItem(key);
  },
};
