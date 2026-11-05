import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Brand, Fonts, type ThemeColor } from '@/constants/theme';
import { resolveTextStyle, TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { TEXT_TYPE_STYLES } from './textTypes';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'display'
    | 'title'
    | 'titleSmall'
    | 'stat'
    | 'headline'
    | 'sectionTitle'
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
  ...TEXT_TYPE_STYLES,
  stat: { ...textStyle(TypeScale.stat), fontVariant: ['tabular-nums'] },
  linkPrimary: { ...textStyle(TypeScale.calloutBold), color: Brand.primary },
  code: {
    fontFamily: Fonts?.mono,
    fontWeight: Platform.select({ android: '700', default: '500' }),
    fontSize: TypeScale.callout.fontSize,
  },
});

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const colorStyle = { color: theme[themeColor ?? (type === 'error' ? 'dangerText' : 'text')] };

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={1.5}
      style={[colorStyle, styles[type], resolveTextStyle(StyleSheet.flatten(style) ?? {})]}
      {...rest}
    />
  );
}
