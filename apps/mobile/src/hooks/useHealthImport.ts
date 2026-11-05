import { useCallback, useEffect, useState } from 'react';
import { getPlatform } from '@/platform';
import type { HealthStatus } from '@/platform/ports';
import {
  activityInputFromWorkout,
  type HealthImportResult,
  importWorkouts,
} from '@/services/healthImport';
import { useActivityStore } from '@/stores/activityStore';
import { useHealthStore } from '@/stores/healthStore';
import { logger } from '@/utils/logger';
import { usePostRun } from './usePostRun';

/** Importing workouts from the phone's health data: what is possible, and a button that does it. */
export function useHealthImport() {
  const { save } = usePostRun();
  const [status, setStatus] = useState<HealthStatus | 'checking'>('checking');
  const [hasAccess, setHasAccess] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<HealthImportResult | null>(null);
  const lastImportAt = useHealthStore((s) => s.lastImportAt);

  const refresh = useCallback(async () => {
    const { health } = getPlatform();
    const next = await health.status();
    setStatus(next);
    setHasAccess(next === 'available' ? await health.hasAccess() : false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    const granted = await getPlatform().health.requestAccess();
    setHasAccess(granted);
    return granted;
  }, []);

  const importNow = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    try {
      const { health, clock } = getPlatform();
      const outcome = await importWorkouts({
        health,
        now: () => clock.now(),
        state: {
          read: () => {
            const { watermark, imported } = useHealthStore.getState();
            return { watermark, imported };
          },
          write: (next) => useHealthStore.getState().write(next),
        },
        // A run recorded here that a watch recorded too is not imported again.
        existing: () => useActivityStore.getState().activities,
        // Saved like any other activity: on this device first, then on-chain through the usual queue.
        save: async (workout) => {
          await save(activityInputFromWorkout(workout));
        },
      });
      if (outcome.status === 'done') useHealthStore.getState().markImported(clock.now());
      logger.info(`[Health] Import finished: ${outcome.status}`);
      setResult(outcome);
    } catch (error) {
      logger.warn('[Health] Import failed', error);
      setResult({ status: 'unavailable' });
    } finally {
      setImporting(false);
    }
  }, [importing, save]);

  return { status, hasAccess, importing, result, lastImportAt, connect, importNow, refresh };
}
