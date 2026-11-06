import { t as defaultT, type TFunction } from '@/i18n';

/** Says exactly what would be lost; the sentence is left out when nothing is waiting. */
export function deleteDataMessage(
  unsentChanges: number,
  unsavedActivities: number,
  t: TFunction = defaultT
): string {
  const parts: string[] = [];
  if (unsentChanges > 0) parts.push(t('deleteData.unsentChanges', { count: unsentChanges }));
  if (unsavedActivities > 0) {
    parts.push(t('deleteData.unsavedActivities', { count: unsavedActivities }));
  }
  const base = t('deleteData.base');
  if (parts.length === 0) return base;
  return t('deleteData.removesForGood', { parts: parts.join(t('deleteData.joiner')), base });
}
