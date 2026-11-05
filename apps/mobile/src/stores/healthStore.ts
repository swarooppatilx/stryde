import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { HealthImportState } from '@/services/healthImport';
import { chainScopedStorageAdapter } from '@/utils/storage';

interface HealthStoreState extends HealthImportState {
  lastImportAt: number | null;
  write(next: HealthImportState): void;
  markImported(at: number): void;
  reset(): void;
}

/** What has already been brought in from the phone's health data, so an import never repeats. */
export const useHealthStore = create<HealthStoreState>()(
  persist(
    (set) => ({
      watermark: null,
      imported: [],
      lastImportAt: null,
      write: (next) => set({ watermark: next.watermark, imported: next.imported }),
      markImported: (at) => set({ lastImportAt: at }),
      reset: () => set({ watermark: null, imported: [], lastImportAt: null }),
    }),
    {
      name: '@stryde/health-import',
      version: 1,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);
