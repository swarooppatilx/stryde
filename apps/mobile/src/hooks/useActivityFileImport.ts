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
import { untilSaved } from '@/utils/untilSaved';
import { useUnitSystem } from './use-unit-system';
import { usePostRun } from './usePostRun';

/** Choosing GPX, TCX and FIT files, reviewing what they hold, and saving the ones the athlete keeps. */
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
          problems.push(`${asset.name} is not a GPX, TCX or FIT file.`);
          continue;
        }
        if ((asset.size ?? 0) > MAX_GPX_BYTES) {
          problems.push(`${asset.name} is too large to read.`);
          continue;
        }
        try {
          const content =
            fileKind(asset.name) === 'fit'
              ? await files.readBytes(asset.uri)
              : await files.readText(asset.uri);
          const parsed = parseActivityFile(asset.name, content, { splitMeters });
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
    const { defaultPrivacy: privacy, hideRouteEnds, privacyZones } = useSettingsStore.getState();
    let imported = 0;
    let failed = 0;
    for (const item of items) {
      if (!item.selected) continue;
      try {
        // Saved on the device is what an import promises; uploading and the onchain steps carry on in
        // the background (and the sync retry picks up whatever fails), so a slow chain never holds the button.
        await untilSaved(
          (onSaved) => save({ ...item.input, privacy, hideRouteEnds, privacyZones }, onSaved),
          (error) => logger.warn('[Import] Background sync of an imported activity failed', error)
        );
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
