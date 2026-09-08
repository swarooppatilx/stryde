/**
 * Design tokens for Stryde.
 *
 * These feed two places: our own `useTheme()` hook (for plain RN styling)
 * and the Ant Design Mobile `Provider` (for @ant-design/react-native
 * components), so both systems always agree on color/spacing/radius.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** Converts a hex color to an rgba() string at the given alpha (0-1). */
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

export const Brand = {
  primary: '#E14502',
  primaryPressed: '#B83801',
  primaryTint: tint('#E14502', 0.12),
  success: '#1A9E5C',
  warning: '#D4900A',
  danger: '#E5484D',
  info: '#2B5AC1',
  white: '#FFFFFF',
  black: '#0B0B0C',
} as const;

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
    text: '#14171A',
    textSecondary: '#4B5563',
    background: '#FFFFFF',
    backgroundElement: '#F5F5F6',
    backgroundSelected: '#ECEDEF',
    border: '#E5E7EB',
  },
  dark: {
    text: '#F7F7F8',
    textSecondary: '#9BA1A6',
    background: '#0B0B0C',
    backgroundElement: '#1C1C1E',
    backgroundSelected: '#3A3A3C',
    border: '#2E2E30',
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
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const SIZES = {
  icon: {
    small: 16,
    medium: 24,
    large: 32,
  },
  button: {
    minTouch: 44,
    toolbar: 36,
  },
  padding: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

/** Shadow variants tuned for dark surfaces, where black shadows vanish. */
export const ShadowDark = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

/**
 * Partial<Theme> for @ant-design/react-native's <Provider theme={...}>.
 * Token names come from the library's own theme shape, not ours -
 * see node_modules/@ant-design/react-native/lib/style/themes/default.js.
 */
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
