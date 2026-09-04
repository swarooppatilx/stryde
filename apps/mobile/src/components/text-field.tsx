import { Input } from '@ant-design/react-native';
import { forwardRef } from 'react';
import { StyleSheet, type TextInput, type TextInputProps, View } from 'react-native';

import { BorderRadius, Brand, Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  error?: string | null;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { error, ...rest },
  ref
) {
  return (
    <View style={styles.wrapper}>
      <Input ref={ref} inputStyle={styles.input} status={error ? 'error' : undefined} {...rest} />
      {error ? (
        <ThemedText type="small" style={{ color: Brand.danger }}>
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
  input: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    fontSize: 16,
  },
});
