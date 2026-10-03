import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { Tappable } from '@/components/tappable';
import { BorderRadius, Brand, Spacing, tint } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { formatLongDate, latestBirthday } from '@/utils/dates';
import { ThemedText } from './themed-text';

const EARLIEST_BIRTHDAY = new Date(1920, 0, 1);

interface Props {
  value: Date | null;
  onChange(date: Date): void;
  /** `brand` for onboarding, `neutral` inside forms. */
  tone?: 'brand' | 'neutral';
  style?: StyleProp<ViewStyle>;
}

/** Shows the chosen birthday and opens the OS date picker when tapped. */
export function BirthdayField({ value, onChange, tone = 'neutral', style }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const latest = latestBirthday();
  const look =
    tone === 'brand'
      ? {
          background: tint(Brand.primary, 0.06),
          border: Brand.primary,
          text: value ? Brand.primary : tint(Brand.primary, 0.5),
          icon: Brand.primary,
        }
      : {
          background: theme.backgroundElement,
          border: theme.border,
          text: value ? theme.text : theme.textSecondary,
          icon: theme.textSecondary,
        };

  return (
    <>
      <Tappable
        style={[
          styles.button,
          { backgroundColor: look.background, borderColor: look.border },
          style,
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={value ? `Birthday, ${formatLongDate(value)}` : 'Select your birthday'}
      >
        <ThemedText style={[styles.text, { color: look.text }]}>
          {value ? formatLongDate(value) : 'Select your birthday'}
        </ThemedText>
        <Ionicons name="calendar-outline" size={20} color={look.icon} />
      </Tappable>

      {open && (
        <DateTimePicker
          value={value ?? latest}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={(_, date) => {
            // iOS's inline spinner stays open while scrolling; Android's dialog closes on pick.
            setOpen(Platform.OS === 'ios');
            onChange(date);
          }}
          onDismiss={() => setOpen(false)}
          maximumDate={latest}
          minimumDate={EARLIEST_BIRTHDAY}
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
