import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { SPORT_TYPES } from '@/constants/activity';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityType } from '@/types';
import { haptics } from '@/utils/haptics';

interface SportTypePickerProps {
  selected: ActivityType;
  onSelect: (type: ActivityType) => void;
}

const CATEGORIES = [
  { key: 'cardio', label: 'Cardio' },
  { key: 'strength', label: 'Strength' },
  { key: 'mind', label: 'Mind & Body' },
  { key: 'sport', label: 'Sports' },
] as const;

export function SportTypePicker({ selected, onSelect }: SportTypePickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      {CATEGORIES.map((cat) => {
        const items = SPORT_TYPES.filter((s) => s.category === cat.key);
        if (items.length === 0) return null;
        return (
          <View key={cat.key} style={styles.category}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              {cat.label}
            </ThemedText>
            <View style={styles.row}>
              {items.map((sport) => {
                const isSelected = sport.type === selected;
                return (
                  <Tappable
                    key={sport.type}
                    style={[
                      styles.chip,
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
                      onSelect(sport.type);
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={sport.label}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Ionicons
                      name={sport.icon}
                      size={20}
                      color={isSelected ? theme.brand.primary : theme.textSecondary}
                    />
                    <ThemedText
                      type="small"
                      style={{ color: isSelected ? theme.brand.primary : theme.text }}
                    >
                      {sport.label}
                    </ThemedText>
                  </Tappable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  category: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
