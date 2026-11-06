import type { Colors } from '@/constants/theme';
import type { AlertButton } from '@/stores/alertStore';

type Theme = (typeof Colors)['light' | 'dark'];

/**
 * Button label colour for the app's dialog. The brand fills (orange 3.3:1 on white, the danger red)
 * are for backgrounds and icons; a small label on the card needs the `*Text` roles, which clear AA
 * in both themes.
 */
export function alertButtonColor(style: AlertButton['style'], theme: Theme): string {
  if (style === 'destructive') return theme.dangerText;
  if (style === 'cancel') return theme.textSecondary;
  return theme.accentText;
}
