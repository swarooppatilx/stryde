/** Design tokens shared by `useTheme()` and the Ant Design Mobile `Provider`. */

import { Platform } from 'react-native';

import { Palette } from './palette';

export function tint(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Fills and icons. Text in a status colour uses the `*Text` roles in `Colors`, which clear AA. */
export const Brand = {
  primary: Palette.orange.o3,
  primaryPressed: Palette.orange.o2,
  primaryTint: tint(Palette.orange.o3, 0.12),
  success: Palette.green.g2,
  warning: Palette.yellow.y3,
  danger: Palette.red.r3,
  dangerPressed: Palette.red.r2,
  info: Palette.blue.b3,
  verified: Palette.blue.b4,
  white: Palette.white,
  black: Palette.black,
} as const;

/** Other athletes' territory on the map (the viewer's own is the brand orange). */
export const OTHERS_TERRITORY_COLOR = Palette.violet.v3;

/** Activity-density colours for the map heatmap: [density stop, colour], cool to hot. */
export const HEAT_RAMP = [
  [0, tint(Palette.green.g2, 0)],
  [0.25, tint(Palette.violet.v3, 0.4)],
  [0.5, tint(Palette.pink.p3, 0.55)],
  [0.75, tint(Palette.orange.o3, 0.7)],
  [1, tint(Palette.red.r3, 0.9)],
] as const;

export const AchievementColors = {
  green: '#34C759',
  orange: '#FF9500',
  yellow: '#FFD60A',
  blue: '#007AFF',
  indigo: '#5856D6',
  purple: '#AF52DE',
  red: '#FF3B30',
} as const;

export const Colors = {
  light: {
    text: Palette.black,
    textSecondary: Palette.neutral.n2,
    textTertiary: Palette.neutral.n3,
    placeholder: Palette.neutral.n3,
    disabled: Palette.neutral.n45,
    // The page is the grey canvas and a card is white on it (the reference's day theme: sunken n6
    // canvas, white raised surface). The old pairing, a #FAFAFA card on a white page, was 1.04:1.
    background: Palette.neutral.n6,
    backgroundElement: Palette.white,
    backgroundSelected: Palette.neutral.n6,
    backgroundSunken: Palette.neutral.n6,
    // Menus, toasts and notices that float over content: white in light, a raised grey in dark.
    backgroundOverlay: Palette.white,
    // The bottom bar: a white surface on the grey canvas in light mode, one step above black in dark.
    navbar: Palette.white,
    // Small orange text: the fill orange is 3.3:1 on white, short of AA (4.5), so text uses a deeper step.
    accentText: Palette.orange.o25,
    successText: Palette.green.g1,
    warningText: Palette.yellow.y05,
    dangerText: Palette.red.r2,
    border: Palette.neutral.n5,
    borderBold: Palette.neutral.n45,
  },
  dark: {
    text: Palette.white,
    textSecondary: Palette.neutral.n6,
    textTertiary: Palette.neutral.n45,
    placeholder: Palette.neutral.n4,
    disabled: Palette.neutral.n3,
    background: Palette.black,
    backgroundElement: Palette.neutral.n05,
    backgroundSelected: Palette.neutral.n1,
    backgroundSunken: Palette.neutral.n1,
    backgroundOverlay: Palette.neutral.n1,
    navbar: Palette.neutral.n05,
    accentText: Palette.orange.o3,
    successText: Palette.green.g4,
    warningText: Palette.yellow.y3,
    dangerText: Palette.red.r5,
    border: Palette.neutral.n2,
    borderBold: Palette.neutral.n3,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});

/** Icon sizes by role: header buttons carry 24dp glyphs on 48dp targets, row marks match body size. */
export const IconSize = {
  /** Icon-only identity marks: pill disc, streak flame, verified shield. */
  badge: 16,
  inline: 18,
  action: 24,
  /** Summary figures, paired with TypeScale.stat. */
  stat: 32,
  hero: 40,
} as const;

/** Touch targets. 48dp is the Android minimum; extend with hitSlop rather than shrink below it. */
export const Touch = {
  target: 48,
  /** Comfortable list rows (the one-row minimum sits at 62dp). */
  row: 64,
} as const;

/** 2pt-grid steps, named by ordinal: `twoHalf` and `threeHalf` sit between whole steps. */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  twoHalf: 12,
  three: 16,
  threeHalf: 20,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BorderRadius = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
} as const;

/** Partial<Theme> for the Ant Design `Provider`; token names follow the library's theme shape. */
export function getAntTheme(scheme: 'light' | 'dark') {
  const c = Colors[scheme];

  return {
    brand_primary: Brand.primary,
    brand_primary_tap: Brand.primaryPressed,
    brand_success: Brand.success,
    brand_warning: Brand.warning,
    brand_error: Brand.danger,
    brand_important: Brand.danger,

    color_text_base: c.text,
    color_text_base_inverse: Brand.white,
    color_text_placeholder: c.textSecondary,
    color_text_disabled: c.textSecondary,
    color_text_caption: c.textSecondary,
    color_text_paragraph: c.text,
    color_link: Brand.info,
    color_icon_base: c.textSecondary,

    fill_body: c.background,
    fill_base: c.backgroundElement,
    fill_tap: c.backgroundSelected,
    fill_disabled: c.backgroundSelected,
    fill_mask: 'rgba(0, 0, 0, 0.45)',
    fill_grey: c.backgroundElement,

    border_color_base: c.border,
    border_color_thin: c.border,

    radius_xs: 4,
    radius_sm: BorderRadius.sm,
    radius_md: BorderRadius.md,
    radius_lg: BorderRadius.lg,

    font_size_base: 16,
    font_size_subhead: 15,
    font_size_caption: 13,
    font_size_heading: 17,

    button_height: 52,
    button_height_sm: 36,
    button_font_size: 17,
    button_font_size_sm: 14,
    primary_button_fill: Brand.primary,
    primary_button_fill_tap: Brand.primaryPressed,
    ghost_button_color: Brand.primary,
    ghost_button_fill_tap: tint(Brand.primary, 0.13),
    warning_button_fill: Brand.danger,
    warning_button_fill_tap: Brand.danger,

    list_item_height: 52,
    tabs_height: 46,
  };
}
