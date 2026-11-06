import { t as defaultT, type TFunction } from '@/i18n';
import { confirmDestructive } from '@/utils/confirmDestructive';

/** Asks before retiring gear, since a retired item is no longer offered when saving an activity. */
export function confirmRetire(name: string, onConfirm: () => void, t: TFunction = defaultT): void {
  confirmDestructive({
    title: t('gear.retireTitle', { name }),
    message: t('gear.retireBody'),
    confirmLabel: t('gear.retire'),
    cancelLabel: t('gear.keep'),
    onConfirm,
  });
}
