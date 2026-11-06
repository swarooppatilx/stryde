import { getPlatform } from '@/platform';
import { runHealthImport } from '@/services/healthImportRun';
import type { PostRunInput } from '@/services/postRun';
import { useHealthStore } from '@/stores/healthStore';
import { logger } from '@/utils/logger';
import { countOf } from '@/utils/plural';

/** Opening the app again within this long of the last check does not check again. */
export const AUTO_SYNC_MIN_GAP_MS = 30 * 60_000;

export interface SyncGate {
  enabled: boolean;
  hasAccess: boolean;
  lastAttemptAt: number | null;
  now: number;
  minGapMs: number;
  inFlight: boolean;
}

export function shouldSyncNow(gate: SyncGate): boolean {
  if (!gate.enabled || !gate.hasAccess || gate.inFlight) return false;
  return gate.lastAttemptAt === null || gate.now - gate.lastAttemptAt >= gate.minGapMs;
}

let inFlight = false;

/**
 * Checks for new workouts if the athlete turned that on and it is time. Never throws and never runs
 * twice at once; the attempt is stamped first so a failing check is not retried on every open.
 */
export async function autoSyncOnce(
  savePostRun: (input: PostRunInput) => Promise<unknown>
): Promise<boolean> {
  if (inFlight || !useHealthStore.getState().autoSync) return false;
  inFlight = true;
  try {
    const { health, clock } = getPlatform();
    const state = useHealthStore.getState();
    const now = clock.now();
    const attempts = [state.lastImportAt, state.lastAutoSyncAttemptAt].filter(
      (at): at is number => at !== null
    );
    const allowed = shouldSyncNow({
      enabled: state.autoSync,
      hasAccess: (await health.status()) === 'available' && (await health.hasAccess()),
      lastAttemptAt: attempts.length > 0 ? Math.max(...attempts) : null,
      now,
      minGapMs: AUTO_SYNC_MIN_GAP_MS,
      inFlight: false,
    });
    if (!allowed) return false;
    useHealthStore.getState().markAutoSyncAttempt(now);
    const outcome = await runHealthImport(savePostRun);
    if (outcome.status === 'done') {
      useHealthStore
        .getState()
        .setLastAutoSync({ at: clock.now(), imported: outcome.imported, skipped: outcome.skipped });
    }
    return true;
  } catch (error) {
    logger.warn('[Health] Automatic sync failed', error);
    return false;
  } finally {
    inFlight = false;
  }
}

/** The quiet result line: "Last checked 5m ago: 2 new workouts". */
export function describeAutoSync(last: { at: number; imported: number }, ago: string): string {
  const found =
    last.imported === 0 ? 'no new workouts' : countOf(last.imported, 'new workout', 'new workouts');
  return `Last checked ${ago}: ${found}`;
}
