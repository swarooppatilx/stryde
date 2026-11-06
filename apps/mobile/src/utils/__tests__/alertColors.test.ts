import { describe, expect, it, vi } from 'vitest';

// `@/constants/theme` reads Platform at import time.
vi.mock('react-native', () => ({ Platform: { select: () => ({}) } }));

import { Colors } from '@/constants/theme';
import { alertButtonColor } from '@/utils/alertColors';
import { contrastRatio } from '@/utils/contrast';

const STYLES = ['default', 'cancel', 'destructive', undefined] as const;
const AA_SMALL_TEXT = 4.5;

describe('alertButtonColor', () => {
  for (const mode of ['light', 'dark'] as const) {
    for (const style of STYLES) {
      it(`${style ?? 'unstyled'} buttons are readable on the ${mode} dialog card`, () => {
        const theme = Colors[mode];
        const color = alertButtonColor(style, theme);
        expect(contrastRatio(color, theme.backgroundElement)).toBeGreaterThanOrEqual(AA_SMALL_TEXT);
      });
    }
  }

  it('keeps the three roles visually distinct', () => {
    const theme = Colors.light;
    const colors = new Set([
      alertButtonColor('default', theme),
      alertButtonColor('cancel', theme),
      alertButtonColor('destructive', theme),
    ]);
    expect(colors.size).toBe(3);
  });

  it('uses the danger text role, not the fill red, for destructive', () => {
    expect(alertButtonColor('destructive', Colors.light)).toBe(Colors.light.dangerText);
    expect(alertButtonColor('destructive', Colors.dark)).toBe(Colors.dark.dangerText);
  });
});
