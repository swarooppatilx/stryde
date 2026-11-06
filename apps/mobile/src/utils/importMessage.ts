import { t as defaultT, type TFunction } from '@/i18n';

/** What the import screen says; none of it names how activities are stored. */
export const IMPORT_COPY = {
  title: 'Import activities',
  intro:
    'Bring in activities you recorded with a watch or another app. Choose one or more files; you can review them before anything is added.',
  formats: 'GPX, TCX and FIT files',
  choose: 'Choose files',
  chooseMore: 'Choose other files',
  importing: 'Importing',
  duplicate: 'Looks like one you already have',
  empty: 'Nothing to import from those files.',
  privacy: 'Imported activities use your usual privacy setting.',
} as const;

export interface FileImportCounts {
  imported: number;
  skipped: number;
  failed: number;
}

/** The result line after an import: how many went in, how many were left out, and any that failed. */
export function describeFileImport(
  { imported, skipped, failed }: FileImportCounts,
  t: TFunction = defaultT
): string {
  if (failed > 0) return t('importFiles.resultFailed', { imported, skipped, failed });
  return t('importFiles.result', { imported, skipped });
}
