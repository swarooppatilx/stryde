import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: number;
}

/** A raised surface: one colour step above the page with a hairline edge, no shadow. */
export function Card({ children, onPress, style, padding = Spacing.five }: CardProps) {
  const theme = useTheme();
  const surface = [
    styles.card,
    { backgroundColor: theme.backgroundElement, borderColor: theme.border, padding },
    style,
  ];

  if (!onPress) {
    return <ThemedView style={surface}>{children}</ThemedView>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [surface, pressed && { backgroundColor: theme.backgroundSelected }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
