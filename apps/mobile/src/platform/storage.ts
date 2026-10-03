import { getPlatform } from './index';
import type { StorageAdapter } from './ports';

/**
 * Forwards every call to the installed platform's storage *at call time*.
 * Zustand's persist() grabs its adapter when a store module is imported, long
 * before any test (or the app) could pass one in — delegating keeps that
 * import-time binding while the real storage stays swappable.
 */
export const platformStorage: StorageAdapter = {
  getItem: (key) => getPlatform().storage.getItem(key),
  setItem: (key, value) => getPlatform().storage.setItem(key, value),
  removeItem: (key) => getPlatform().storage.removeItem(key),
};

/** Prefixes every key with `scope()`, evaluated per call so it follows runtime config. */
export function scopedStorage(base: StorageAdapter, scope: () => string): StorageAdapter {
  return {
    getItem: (key) => base.getItem(`${scope()}:${key}`),
    setItem: (key, value) => base.setItem(`${scope()}:${key}`, value),
    removeItem: (key) => base.removeItem(`${scope()}:${key}`),
  };
}
