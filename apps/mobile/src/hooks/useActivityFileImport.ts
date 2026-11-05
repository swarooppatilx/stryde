import { getDocumentAsync } from 'expo-document-picker';
import { useCallback, useState } from 'react';
import { getPlatform } from '@/platform';
import {
  buildPreview,
  type FileImportItem,
  fileKind,
  type PreviewItem,
  parseActivityFile,
} from '@/services/activityFileImport';
import { useActivityStore } from '@/stores/activityStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { metersPerDistanceUnit } from '@/utils/distanceUnits';
import { MAX_GPX_BYTES } from '@/utils/gpxParse';
import type { FileImportCounts } from '@/utils/importMessage';
import { logger } from '@/utils/logger';
import { useUnitSystem } from './use-unit-system';
import { usePostRun } from './usePostRun';

/** Choosing GPX and TCX files, reviewing what they hold, and saving the ones the athlete keeps. */
export function useActivityFileImport() {
  const { save } = usePostRun();
  const unitSystem = useUnitSystem();
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<FileImportCounts | null>(null);

  const pick = useCallback(async () => {
    if (reading || importing) return;
    setReading(true);
    try {
      const picked = await getDocumentAsync({ type: '*/*', multiple: true });
      if (picked.canceled) return;

      const { files } = getPlatform();
      const splitMeters = metersPerDistanceUnit(unitSystem);
      const found: Array<{ fileName: string; items: FileImportItem[] }> = [];
      const problems: string[] = [];

      for (const asset of picked.assets) {
        if (!fileKind(asset.name)) {
          problems.push(`${asset.name} is not a GPX or TCX file.`);
          continue;
        }
        if ((asset.size ?? 0) > MAX_GPX_BYTES) {
          problems.push(`${asset.name} is too large to read.`);
          continue;
        }
        try {
          const parsed = parseActivityFile(asset.name, await files.readText(asset.uri), {
            splitMeters,
          });
          if (parsed.ok) found.push({ fileName: asset.name, items: parsed.items });
          else problems.push(parsed.message);
        } catch (error) {
          logger.warn('[Import] Could not read file', error);
          problems.push(`${asset.name} could not be opened.`);
        }
      }

      setItems(buildPreview(found, useActivityStore.getState().activities));
      setErrors(problems);
      setResult(null);
    } catch (error) {
      logger.warn('[Import] Picking files failed', error);
      setErrors(['Could not open the file picker.']);
    } finally {
      setReading(false);
    }
  }, [reading, importing, unitSystem]);

  const toggle = useCallback((id: string) => {
    setItems((current) => current.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i)));
  }, []);

  const importSelected = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    const privacy = useSettingsStore.getState().defaultPrivacy;
    let imported = 0;
    let failed = 0;
    for (const item of items) {
      if (!item.selected) continue;
      try {
        await save({ ...item.input, privacy });
        imported++;
      } catch (error) {
        logger.warn('[Import] Could not save an activity', error);
        failed++;
      }
    }
    setResult({ imported, skipped: items.filter((i) => !i.selected).length, failed });
    setItems([]);
    setErrors([]);
    setImporting(false);
  }, [importing, items, save]);

  return {
    items,
    errors,
    reading,
    importing,
    result,
    selectedCount: items.filter((i) => i.selected).length,
    pick,
    toggle,
    importSelected,
  };
}
