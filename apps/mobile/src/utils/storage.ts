import AsyncStorage from '@react-native-async-storage/async-storage';

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
