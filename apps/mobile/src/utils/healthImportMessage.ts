import type { HealthImportResult } from '@/services/healthImport';
import { countOf } from '@/utils/plural';

/** What to tell the athlete after an import, in plain words. */
export function describeImport(result: HealthImportResult): string {
  switch (result.status) {
    case 'unavailable':
      return 'Health Connect is not available on this phone.';
    case 'update-required':
      return 'Update Health Connect from the Play Store, then try again.';
    case 'no-access':
      return 'Allow Stryde to read your workouts first.';
    case 'done': {
      const { imported, skipped, failed } = result;
      const parts = [
        imported === 0
          ? 'No new workouts.'
          : `Imported ${countOf(imported, 'workout', 'workouts')}.`,
      ];
      if (skipped > 0) parts.push(`${skipped} already in Stryde.`);
      if (failed > 0) parts.push(`${failed} could not be saved; try again.`);
      return parts.join(' ');
    }
  }
}
