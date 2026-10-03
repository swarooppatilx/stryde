import { StyleSheet } from 'react-native';
import { Tappable } from '@/components/tappable';
import { FEEL_OPTIONS } from '@/constants/activity';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityFeel } from '@/types';
import { haptics } from '@/utils/haptics';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Props {
  selected: ActivityFeel | undefined;
  /** Tapping the selected option again clears it. */
  onSelect(feel: ActivityFeel | undefined): void;
}

export function FeelPicker({ selected, onSelect }: Props) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.row} accessibilityRole="radiogroup">
      {FEEL_OPTIONS.map((option) => {
        const isSelected = selected === option.value;
        return (
          <Tappable
            key={option.value}
            style={[
              styles.option,
              {
                backgroundColor: isSelected
                  ? tint(theme.brand.primary, 0.12)
                  : theme.backgroundElement,
                borderColor: isSelected ? theme.brand.primary : theme.border,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => {
              haptics.selection();
              onSelect(isSelected ? undefined : option.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected }}
          >
            <ThemedText style={styles.emoji}>{option.emoji}</ThemedText>
            <ThemedText
              type="caption"
              style={{ color: isSelected ? theme.brand.primary : theme.textSecondary }}
            >
              {option.label}
            </ThemedText>
          </Tappable>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  // A glyph, not text: sized to fill its tile, outside the type scale.
  emoji: { fontSize: 24 },
});
