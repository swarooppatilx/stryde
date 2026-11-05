import { ScrollView, StyleSheet } from 'react-native';
import { Tappable } from '@/components/tappable';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Gear } from '@/types';
import { ThemedText } from './themed-text';

interface Props {
  options: readonly Gear[];
  /** `Gear.id`, or null for none. */
  selected: string | null;
  onSelect(id: string | null): void;
}

/** A row of chips: one per pair of shoes or bike, and "None". */
export function GearPicker({ options, selected, onSelect }: Props) {
  const theme = useTheme();
  const choices: { id: string | null; label: string }[] = [
    ...options.map((g) => ({ id: g.id, label: g.name })),
    { id: null, label: 'None' },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
    >
      {choices.map((choice) => {
        const isSelected = selected === choice.id;
        return (
          <Tappable
            key={choice.id ?? 'none'}
            onPress={() => onSelect(choice.id)}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? Brand.primary : theme.backgroundElement,
                borderColor: isSelected ? Brand.primary : theme.border,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          >
            <ThemedText type="small" style={{ color: isSelected ? Brand.white : theme.text }}>
              {choice.label}
            </ThemedText>
          </Tappable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
