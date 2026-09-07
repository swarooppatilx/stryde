import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export function OtpInput({ length = 6, value, onChange, autoFocus = true }: OtpInputProps) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <View style={styles.wrapper}>
      <View style={styles.boxRow}>
        {digits.map((digit, i) => {
          const isActive = focused && i === activeIndex;
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: isActive ? theme.brand.primary : 'transparent',
                },
              ]}
            >
              <ThemedText type="subtitle" style={styles.digit}>
                {digit}
              </ThemedText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoFocus={autoFocus}
        maxLength={length}
        style={styles.hiddenInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  boxRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  box: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: 22,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
  },
});
