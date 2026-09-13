import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ChainMode, DEFAULT_CHAIN_MODE, getChainConfig } from '@repo/shared';

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const asyncStorageAdapter: StorageAdapter = AsyncStorage;

/**
 * Persisted stores are serialized to JSON, which has no Date type. Without a
 * reviver, `Activity.createdAt` (typed `Date`) rehydrates as a string and any
 * code that calls Date methods on it crashes. Restore ISO strings back to
 * real Dates so the declared `Date` types are truthful at runtime.
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isoDateReviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) {
    return new Date(value);
  }
  return value;
}

/**
 * Keys scoped to the active chain mode + deployment (keyed by the
 * ProfileRegistry address), so on-chain-derived data persisted for one
 * network or contract deploy never shows up under another — e.g. Anvil
 * activities appearing after switching to Sepolia, or stale ids after a
 * local redeploy. App-wide state (settings, an in-progress run) should keep
 * using the unscoped adapter above.
 */
function chainScope(): string {
  // Read straight from the env + shared config (not @/constants/config) so
  // this module stays free of react-native imports and usable in unit tests.
  const mode = (process.env.EXPO_PUBLIC_CHAIN_MODE || DEFAULT_CHAIN_MODE) as ChainMode;
  const profileRegistry = getChainConfig(mode).contracts.profileRegistry.toLowerCase();
  return `${mode}:${profileRegistry}`;
}

export const chainScopedStorageAdapter: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(`${chainScope()}:${key}`),
  setItem: (key, value) => AsyncStorage.setItem(`${chainScope()}:${key}`, value),
  removeItem: (key) => AsyncStorage.removeItem(`${chainScope()}:${key}`),
};
