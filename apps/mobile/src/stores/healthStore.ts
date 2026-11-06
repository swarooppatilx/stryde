import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { HealthImportState } from '@/services/healthImport';
import { chainScopedStorageAdapter } from '@/utils/storage';

export interface AutoSyncResult {
  at: number;
  imported: number;
  skipped: number;
}

interface HealthStoreState extends HealthImportState {
  lastImportAt: number | null;
  autoSync: boolean;
  lastAutoSync: AutoSyncResult | null;
  lastAutoSyncAttemptAt: number | null;
  write(next: HealthImportState): void;
  markImported(at: number): void;
  setAutoSync(on: boolean): void;
  markAutoSyncAttempt(at: number): void;
  setLastAutoSync(result: AutoSyncResult): void;
  reset(): void;
}

const AUTO_SYNC_DEFAULTS = { autoSync: false, lastAutoSync: null, lastAutoSyncAttemptAt: null };

/** What has already been brought in from the phone's health data, so an import never repeats. */
export const useHealthStore = create<HealthStoreState>()(
  persist(
    (set) => ({
      watermark: null,
      imported: [],
      lastImportAt: null,
      ...AUTO_SYNC_DEFAULTS,
      write: (next) => set({ watermark: next.watermark, imported: next.imported }),
      markImported: (at) => set({ lastImportAt: at }),
      setAutoSync: (on) => set({ autoSync: on }),
      markAutoSyncAttempt: (at) => set({ lastAutoSyncAttemptAt: at }),
      setLastAutoSync: (result) => set({ lastAutoSync: result }),
      reset: () =>
        set({ watermark: null, imported: [], lastImportAt: null, ...AUTO_SYNC_DEFAULTS }),
    }),
    {
      name: '@stryde/health-import',
      version: 2,
      migrate: (persisted, version) =>
        version < 2 ? { ...(persisted as object), ...AUTO_SYNC_DEFAULTS } : persisted,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);
