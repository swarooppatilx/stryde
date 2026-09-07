import type { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Shadow, ShadowDark, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: number;
}

export function Card({ children, onPress, style, padding = Spacing.five }: CardProps) {
  const theme = useTheme();

  const content = (
    <ThemedView
      style={[
        styles.card,
        theme.isDark ? ShadowDark.card : Shadow.card,
        { backgroundColor: theme.backgroundElement },
        { padding },
        style,
      ]}
    >
      {children}
    </ThemedView>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
  },
});
