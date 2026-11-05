import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { select: (o: Record<string, unknown>) => o.default },
  StyleSheet: { hairlineWidth: 1 },
}));

const { Brand, Colors } = await import('@/constants/theme');
const { contrastRatio } = await import('@/utils/contrast');
const { tabTints } = await import('@/utils/tabBarTint');

const themeFor = (mode: 'light' | 'dark') => ({ ...Colors[mode], brand: Brand });

describe('tabTints', () => {
  it.each(['light', 'dark'] as const)(
    'turns the icon and the label when a tab is selected (%s)',
    (mode) => {
      const tints = tabTints(themeFor(mode));

      expect(tints.icon.active).not.toBe(tints.icon.inactive);
      expect(tints.label.active).not.toBe(tints.label.inactive);
    }
  );

  it.each(['light', 'dark'] as const)(
    'keeps the selected label readable on the bar (%s)',
    (mode) => {
      const theme = themeFor(mode);
      const { label } = tabTints(theme);

      expect(contrastRatio(label.active, theme.navbar)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(label.inactive, theme.navbar)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it.each(['light', 'dark'] as const)('keeps the selected icon visible on the bar (%s)', (mode) => {
    const theme = themeFor(mode);
    const { icon } = tabTints(theme);

    expect(contrastRatio(icon.active, theme.navbar)).toBeGreaterThanOrEqual(3);
  });

  it('uses the brand orange for the icon and the deeper accent for small label text', () => {
    const tints = tabTints(themeFor('light'));

    expect(tints.icon.active).toBe(Brand.primary);
    expect(tints.label.active).toBe(Colors.light.accentText);
  });
});
