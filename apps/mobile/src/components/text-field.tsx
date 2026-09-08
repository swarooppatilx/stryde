import { Input } from '@ant-design/react-native';
import { forwardRef } from 'react';
import { StyleSheet, type TextInput, type TextInputProps, View } from 'react-native';

import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  error?: string | null;
  label?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { error, label, multiline, ...rest },
  ref
) {
  const theme = useTheme();
  const borderColor = error ? Brand.danger : theme.border;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <ThemedText type="small" style={[styles.label, { color: theme.text }]}>
          {label}
        </ThemedText>
      ) : null}
      {multiline ? (
        <Input.TextArea
          ref={ref}
          multiline
          inputStyle={[styles.input, styles.multilineInput, { borderColor }]}
          placeholderTextColor={theme.textSecondary}
          {...rest}
        />
      ) : (
        <Input
          ref={ref}
          inputStyle={[styles.input, { borderColor }]}
          status={error ? 'error' : undefined}
          placeholderTextColor={theme.textSecondary}
          {...rest}
        />
      )}
      {error ? (
        <ThemedText
          type="small"
          style={{ color: Brand.danger }}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
  },
  label: {
    fontWeight: '600',
  },
  input: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
