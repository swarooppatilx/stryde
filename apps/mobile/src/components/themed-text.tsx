import { useMemo } from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Brand, Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'headline'
    | 'sectionTitle'
    | 'subtitle'
    | 'small'
    | 'smallBold'
    | 'caption'
    | 'eyebrow'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'button'
    | 'error';
  themeColor?: ThemeColor;
};

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: Brand.primary,
    fontWeight: '600',
  },
  code: {
    fontFamily: Fonts?.mono,
    fontWeight: Platform.select({ android: '700', default: '500' }),
    fontSize: 12,
  },
  button: {
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    fontSize: 14,
    color: Brand.danger,
  },
});

const TYPE_STYLE_MAP = {
  default: styles.default,
  title: styles.title,
  headline: styles.headline,
  sectionTitle: styles.sectionTitle,
  small: styles.small,
  smallBold: styles.smallBold,
  caption: styles.caption,
  eyebrow: styles.eyebrow,
  subtitle: styles.subtitle,
  link: styles.link,
  linkPrimary: styles.linkPrimary,
  code: styles.code,
  button: styles.button,
  error: styles.error,
} as const;

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const colorStyle = useMemo(
    () => ({ color: themeColor ? theme[themeColor] : theme.text }),
    [theme, themeColor]
  );

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={1.5}
      style={[colorStyle, TYPE_STYLE_MAP[type], style]}
      {...rest}
    />
  );
}
