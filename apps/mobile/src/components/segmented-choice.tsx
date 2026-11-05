import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface Props<T extends string> {
  options: readonly { value: T; label: string }[];
  selected: T | undefined;
  onSelect(value: T): void;
  /** When given, tapping the selected option again calls this (to clear the choice). */
  onClear?(): void;
  /** Tighter pills, so more of them share a row on a narrow phone. */
  compact?: boolean;
  /** Pills share one row equally, whatever their labels. For a short list that must not wrap. */
  fill?: boolean;
}

/** A few pill-shaped options side by side, one selected. */
export function SegmentedChoice<T extends string>({
  options,
  selected,
  onSelect,
  onClear,
  compact = false,
  fill = false,
}: Props<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.row, fill && styles.rowFill]} accessibilityRole="radiogroup">
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Tappable
            key={option.value}
            onPress={() => (isSelected && onClear ? onClear() : onSelect(option.value))}
            style={[
              styles.pill,
              compact && styles.pillCompact,
              fill && styles.pillFill,
              {
                backgroundColor: isSelected ? Brand.primary : theme.backgroundElement,
                borderColor: isSelected ? Brand.primary : theme.border,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          >
            <ThemedText type="small" style={{ color: isSelected ? Brand.white : theme.text }}>
              {option.label}
            </ThemedText>
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pillCompact: { paddingHorizontal: Spacing.three },
  rowFill: { flexWrap: 'nowrap' },
  pillFill: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.two },
  pill: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
