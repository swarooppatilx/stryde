import { t as defaultT, type TFunction } from '@/i18n';
import type { HealthImportResult } from '@/services/healthImport';

/** What to tell the athlete after an import, in plain words. */
export function describeImport(result: HealthImportResult, t: TFunction = defaultT): string {
  switch (result.status) {
    case 'unavailable':
      return t('healthImport.resultUnavailable');
    case 'update-required':
      return t('healthImport.resultUpdate');
    case 'no-access':
      return t('healthImport.resultNoAccess');
    case 'done': {
      const { imported, skipped, failed } = result;
      const parts = [
        imported === 0
          ? t('healthImport.resultNone')
          : t('healthImport.resultImported', { count: imported }),
      ];
      if (skipped > 0) parts.push(t('healthImport.resultSkipped', { count: skipped }));
      if (failed > 0) parts.push(t('healthImport.resultFailed', { count: failed }));
      return parts.join(' ');
    }
  }
}
