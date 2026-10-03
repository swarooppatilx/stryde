import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type ButtonVariant, buttonAppearance } from '@/utils/buttonAppearance';
import { ThemedText } from './themed-text';

export type { ButtonVariant };

interface AppButtonProps {
  children: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'large' | 'small';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  /** What a screen reader says, when the visible label is shorter than it should be ("Start" for "Start Run"). */
  accessibilityLabel?: string;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function AppButton({
  children,
  icon,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  size = 'large',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: AppButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => {
        const look = buttonAppearance(variant, theme, { pressed, disabled });
        return [
          styles.base,
          size === 'small' ? styles.small : styles.large,
          fullWidth && styles.fullWidth,
          { backgroundColor: look.background, borderColor: look.border },
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const { label } = buttonAppearance(variant, theme, { pressed, disabled });
        return (
          <View style={styles.content}>
            {loading ? <ActivityIndicator size="small" color={label} /> : icon}
            <ThemedText
              type={size === 'small' ? 'smallBold' : 'button'}
              style={{ color: label }}
              numberOfLines={1}
            >
              {children}
            </ThemedText>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
  },
  large: { minHeight: 52 },
  small: { minHeight: 44 },
  fullWidth: { width: '100%' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
