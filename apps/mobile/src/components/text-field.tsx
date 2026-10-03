import { Input } from '@ant-design/react-native';
import type { Ref } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  error?: string | null;
  label?: string;
  ref?: Ref<TextInput>;
}

export function TextField({ error, label, multiline, ref, ...rest }: TextFieldProps) {
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
        <TextInput
          ref={ref}
          multiline
          style={[styles.input, styles.multilineInput, { borderColor, color: theme.text }]}
          placeholderTextColor={theme.placeholder}
          {...rest}
        />
      ) : (
        <Input
          ref={ref}
          inputStyle={[styles.input, { borderColor, color: theme.text }]}
          status={error ? 'error' : undefined}
          placeholderTextColor={theme.placeholder}
          {...rest}
        />
      )}
      {error ? (
        <ThemedText
          type="small"
          themeColor="dangerText"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
  },
  label: {
    fontWeight: '600',
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...textStyle(TypeScale.body),
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
