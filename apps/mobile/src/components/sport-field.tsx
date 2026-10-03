import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { getSportLabel } from '@/constants/activity';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityType } from '@/types';
import { haptics } from '@/utils/haptics';
import { SportTypePicker } from './sport-type-picker';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface SportFieldProps {
  value: ActivityType;
  onChange(type: ActivityType): void;
  label?: string;
}

/** A labelled sport choice: shows the current sport and opens the full picker in place. */
export function SportField({ value, onChange, label = 'Sport' }: SportFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Tappable
        style={[styles.selector, { borderColor: theme.border }]}
        onPress={() => {
          haptics.tap();
          setOpen(!open);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${getSportLabel(value)}`}
        accessibilityState={{ expanded: open }}
      >
        <ThemedText>{getSportLabel(value)}</ThemedText>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.textSecondary}
        />
      </Tappable>
      {open && (
        <SportTypePicker
          selected={value}
          onSelect={(type) => {
            onChange(type);
            setOpen(false);
          }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});
