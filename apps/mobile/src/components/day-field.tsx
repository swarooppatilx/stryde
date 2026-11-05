import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { formatLongDate } from '@/utils/dates';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

interface DayFieldProps {
  label: string;
  value: Date;
  onChange(day: Date): void;
  /** The latest day that can be chosen. */
  maximum: Date;
}

/** A tappable field showing one day; opens the system date picker. */
export function DayField({ label, value, onChange, maximum }: DayFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tappable
        style={[
          styles.button,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatLongDate(value)}`}
      >
        <ThemedText style={styles.text}>{formatLongDate(value)}</ThemedText>
        <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
      </Tappable>
      {open && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={maximum}
          onValueChange={(_, date) => {
            // iOS's inline spinner stays open while scrolling; Android's dialog closes on pick.
            setOpen(Platform.OS === 'ios');
            onChange(date);
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  text: textStyle(TypeScale.body),
});
