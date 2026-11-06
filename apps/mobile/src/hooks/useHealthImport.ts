import { useCallback, useEffect, useState } from 'react';
import { getPlatform } from '@/platform';
import type { HealthStatus } from '@/platform/ports';
import type { HealthImportResult } from '@/services/healthImport';
import { runHealthImport } from '@/services/healthImportRun';
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
  const autoSync = useHealthStore((s) => s.autoSync);
  const lastAutoSync = useHealthStore((s) => s.lastAutoSync);

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

  // Turning it on needs the same access as an import, and only stays on if it was granted.
  const setAutoSync = useCallback(
    async (on: boolean) => {
      if (!on) {
        useHealthStore.getState().setAutoSync(false);
        return;
      }
      const granted = hasAccess || (await connect());
      useHealthStore.getState().setAutoSync(granted);
    },
    [hasAccess, connect]
  );

  const importNow = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    try {
      const outcome = await runHealthImport(save);
      logger.info(`[Health] Import finished: ${outcome.status}`);
      setResult(outcome);
    } catch (error) {
      logger.warn('[Health] Import failed', error);
      setResult({ status: 'unavailable' });
    } finally {
      setImporting(false);
    }
  }, [importing, save]);

  return {
    status,
    hasAccess,
    importing,
    result,
    lastImportAt,
    autoSync,
    lastAutoSync,
    setAutoSync,
    connect,
    importNow,
    refresh,
  };
}
