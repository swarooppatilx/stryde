import { Button as AntButton } from '@ant-design/react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface AppButtonProps {
  children: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'large' | 'small';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const ANT_TYPE: Record<ButtonVariant, 'primary' | 'ghost' | 'warning' | undefined> = {
  primary: 'primary',
  secondary: undefined,
  ghost: 'ghost',
  danger: 'warning',
};

export function AppButton({
  children,
  icon,
  onPress,
  variant = 'primary',
  size = 'large',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: AppButtonProps) {
  const theme = useTheme();

  const textColor =
    variant === 'primary' || variant === 'danger'
      ? Brand.white
      : variant === 'ghost'
        ? Brand.primary
        : theme.text;

  return (
    <AntButton
      type={ANT_TYPE[variant]}
      size={size}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      // The press highlight underlay is a full-bleed child View; on iOS the
      // Pressable does not clip it to the button's borderRadius, so the
      // highlight bleeds past rounded corners. Clip it here.
      styles={{ wrapperStyle: { overflow: 'hidden' } }}
      style={StyleSheet.flatten([fullWidth && styles.fullWidth, style])}
    >
      <View style={styles.content}>
        {icon}
        <Text style={[styles.label, size === 'small' && styles.labelSmall, { color: textColor }]}>
          {children}
        </Text>
      </View>
    </AntButton>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
  },
  labelSmall: {
    fontSize: 14,
    fontWeight: '600',
  },
});
