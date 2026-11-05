import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface StepperProps {
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  format: (value: number) => string;
  accessibilityLabel: string;
}

/** − value + control, clamped to [min, max]. */
export function Stepper({
  value,
  step,
  min,
  max,
  onChange,
  format,
  accessibilityLabel,
}: StepperProps) {
  const theme = useTheme();
  const decreasedDisabled = value <= min;
  const increasedDisabled = value >= max;

  return (
    <View style={styles.stepper}>
      <Tappable
        onPress={() => onChange(Math.max(min, value - step))}
        disabled={decreasedDisabled}
        hitSlop={10}
        style={[styles.stepperButton, decreasedDisabled && styles.stepperButtonDisabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: decreasedDisabled }}
        accessibilityLabel={`Decrease ${accessibilityLabel}`}
      >
        <Ionicons name="remove" size={18} color={theme.brand.primary} />
      </Tappable>
      <ThemedText type="smallBold" style={styles.stepperValue}>
        {format(value)}
      </ThemedText>
      <Tappable
        onPress={() => onChange(Math.min(max, value + step))}
        disabled={increasedDisabled}
        hitSlop={10}
        style={[styles.stepperButton, increasedDisabled && styles.stepperButtonDisabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: increasedDisabled }}
        accessibilityLabel={`Increase ${accessibilityLabel}`}
      >
        <Ionicons name="add" size={18} color={theme.brand.primary} />
      </Tappable>
    </View>
  );
}

/** One choice among a few options, as a row of pills. */
export function Segmented<T extends string | number>({
  label,
  showLabel = false,
  value,
  options,
  onChange,
}: {
  label: string;
  /** Print the label above the options; it is always spoken to screen readers either way. */
  showLabel?: boolean;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  const row = (
    <View style={styles.toggleRowFull}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Tappable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${label}: ${option.label}`}
            style={[
              styles.toggleOption,
              { backgroundColor: active ? theme.brand.primary : theme.backgroundElement },
            ]}
            onPress={() => onChange(option.value)}
          >
            <ThemedText
              type="caption"
              numberOfLines={1}
              style={{
                color: active ? Brand.white : theme.text,
                fontWeight: active ? '700' : '500',
              }}
            >
              {option.label}
            </ThemedText>
          </Tappable>
        );
      })}
    </View>
  );
  if (!showLabel) return row;
  return (
    <View style={styles.labelledSegmented}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {row}
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.3,
  },
  stepperValue: {
    minWidth: 64,
    textAlign: 'center',
  },
  labelledSegmented: { alignSelf: 'stretch', gap: Spacing.two },
  toggleRowFull: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
});
