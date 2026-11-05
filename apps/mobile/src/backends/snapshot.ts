import type { StorageAdapter } from '@/platform/ports';
import { OUTBOX_KEY } from './outbox/outbox';
import { isProfileId, type ProfileId } from './profiles';

/** The saved data a profile owns: each persisted store, the developer session and the outbox. */
export const SNAPSHOT_KEYS: readonly string[] = [
  '@stryde/activities',
  '@stryde/profile',
  '@stryde/territory-polygons',
  '@stryde/world-verification',
  '@stryde/dev-session',
  'stryde-social',
  'stryde-community',
  '@stryde/health-import',
  OUTBOX_KEY,
];

export interface Snapshot {
  version: 1;
  /** Data is saved per profile, so a snapshot only fits the profile it was taken on. */
  profile: ProfileId;
  takenAt: number;
  entries: Record<string, string>;
}

export async function takeSnapshot({
  storage,
  profile,
  now,
}: {
  storage: StorageAdapter;
  profile: ProfileId;
  now: number;
}): Promise<Snapshot> {
  const entries: Record<string, string> = {};
  for (const key of SNAPSHOT_KEYS) {
    const value = await storage.getItem(key);
    if (value !== null) entries[key] = value;
  }
  return { version: 1, profile, takenAt: now, entries };
}

/** Reads snapshot text back, or null if it is not one. Keys that are not app data are dropped. */
export function parseSnapshot(text: string): Snapshot | null {
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null) return null;
    const { version, profile, takenAt, entries } = raw as Record<string, unknown>;
    if (version !== 1 || !isProfileId(profile) || typeof takenAt !== 'number') return null;
    if (typeof entries !== 'object' || entries === null) return null;
    const kept: Record<string, string> = {};
    for (const [key, value] of Object.entries(entries)) {
      if (typeof value !== 'string') return null;
      if (SNAPSHOT_KEYS.includes(key)) kept[key] = value;
    }
    return { version: 1, profile, takenAt, entries: kept };
  } catch {
    return null;
  }
}

export async function resetData(storage: StorageAdapter): Promise<void> {
  for (const key of SNAPSHOT_KEYS) await storage.removeItem(key);
}

export async function restoreSnapshot({
  storage,
  snapshot,
  profile,
}: {
  storage: StorageAdapter;
  snapshot: Snapshot;
  profile: ProfileId;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (snapshot.profile !== profile) {
    return { ok: false, error: `This snapshot was taken on the ${snapshot.profile} profile.` };
  }
  await resetData(storage);
  for (const [key, value] of Object.entries(snapshot.entries)) await storage.setItem(key, value);
  return { ok: true };
}
