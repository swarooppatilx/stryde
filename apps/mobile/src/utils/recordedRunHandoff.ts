import type { StorageAdapter } from '@/platform/ports';
import { platformStorage } from '@/platform/storage';
import { logger } from '@/utils/logger';

/** How many finished runs are held at once; older ones are abandoned recordings and are let go. */
const KEEP = 3;

/**
 * Where finished-but-unsaved runs survive the app being killed. The live recording's own recovery
 * copy is deleted the moment the run is finished, so without this the run exists only in memory
 * until Save is tapped, and Android reclaiming the app on the Save screen loses it.
 */
export const FINISHED_RUN_KEY = '@stryde/finished-runs';

const runs = new Map<string, Record<string, string>>();
let counter = 0;
let storage: StorageAdapter = platformStorage;

/** Swaps where unsaved runs are written; tests give it a fake. */
export function setRecordedRunStorage(next: StorageAdapter): void {
  storage = next;
}

async function persist(): Promise<void> {
  try {
    if (runs.size === 0) await storage.removeItem(FINISHED_RUN_KEY);
    else await storage.setItem(FINISHED_RUN_KEY, JSON.stringify([...runs.entries()]));
  } catch (error) {
    // The run is still in memory; a failed write only loses the kill-survival, never the Save screen.
    logger.warn('[RunHandoff] Could not keep the finished run on disk', error);
  }
}

/**
 * Holds a just-recorded run and returns a short id for the route. A long run's per-second
 * data is far too big to travel in a URL, so the Save screen is given the id and looks the run up.
 */
export function stashRecordedRun(params: Record<string, string>): string {
  counter += 1;
  const id = `run-${counter}`;
  runs.set(id, params);
  while (runs.size > KEEP) {
    const oldest = runs.keys().next().value;
    if (oldest === undefined) break;
    runs.delete(oldest);
  }
  void persist();
  return id;
}

export function peekRecordedRun(id: string): Record<string, string> | undefined {
  return runs.get(id);
}

export function dropRecordedRun(id: string): void {
  runs.delete(id);
  void persist();
}

/**
 * Brings back runs finished in an earlier launch and returns the newest one's id, or null when
 * there is none. A copy that cannot be read is left on disk rather than deleted: the run may
 * still be recoverable, and silently erasing someone's workout is worse than a stale file.
 */
export async function restoreRecordedRuns(): Promise<string | null> {
  if (runs.size > 0) return null;
  let saved: unknown;
  try {
    const raw = await storage.getItem(FINISHED_RUN_KEY);
    if (!raw) return null;
    saved = JSON.parse(raw);
  } catch (error) {
    logger.warn('[RunHandoff] Could not read the finished run from disk', error);
    return null;
  }
  if (!Array.isArray(saved)) return null;
  let newest: string | null = null;
  for (const entry of saved) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'object') {
      continue;
    }
    runs.set(entry[0], entry[1] as Record<string, string>);
    newest = entry[0];
    const n = Number(entry[0].replace('run-', ''));
    if (Number.isFinite(n) && n > counter) counter = n;
  }
  return newest;
}

export function clearRecordedRuns(): void {
  runs.clear();
}
