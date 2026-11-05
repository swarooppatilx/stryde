import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useShake } from '@/hooks/useShake';
import { ThemedText } from './themed-text';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  /** Goes up by one each time the code was refused; the boxes shake and buzz once per change. */
  rejectedCount?: number;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  autoFocus = true,
  rejectedCount = 0,
}: OtpInputProps) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const { style: shakeStyle, shake } = useShake();
  // Only a rise shakes: mounting with an old count (Resend, back and return) is not a new refusal.
  const seenCount = useRef(rejectedCount);
  // biome-ignore lint/correctness/useExhaustiveDependencies: shake exactly when the count goes up
  useEffect(() => {
    if (rejectedCount > seenCount.current) shake();
    seenCount.current = rejectedCount;
  }, [rejectedCount]);

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.boxRow, shakeStyle]}>
        {digits.map((digit, i) => {
          const isActive = focused && i === activeIndex;
          return (
            <View
              key={i}
              accessibilityRole="text"
              accessibilityLabel={`Digit ${i + 1}${digit ? `, ${digit}` : ', empty'}`}
              style={[
                styles.box,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: isActive ? theme.brand.primary : 'transparent',
                },
              ]}
            >
              <ThemedText type="headline" style={styles.digit}>
                {digit}
              </ThemedText>
            </View>
          );
        })}
      </Animated.View>
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
    ...textStyle(TypeScale.headline),
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
  },
});
