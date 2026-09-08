import { useMemo } from 'react';
import { View, type ViewProps } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  /** Paints a theme surface color. Omit for a transparent layout-only wrapper. */
  type?: ThemeColor;
};

export function ThemedView({ style, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();
  const backgroundColor = useMemo(
    () => ({ backgroundColor: type ? theme[type] : 'transparent' }),
    [theme, type]
  );

  return <View style={[backgroundColor, style]} {...otherProps} />;
}
