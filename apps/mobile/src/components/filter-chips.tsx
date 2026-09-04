import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

export const SPORT_FILTERS = ['all', 'run', 'ride', 'hike', 'swim', 'multi'] as const;
export type SportFilter = (typeof SPORT_FILTERS)[number];

export const SPORT_LABELS: Record<SportFilter, string> = {
  all: 'All',
  run: 'Running',
  ride: 'Cycling',
  hike: 'Hiking',
  swim: 'Swimming',
  multi: 'Multi',
};

interface FilterChipsProps {
  value: SportFilter;
  onChange: (filter: SportFilter) => void;
}

export function FilterChips({ value, onChange }: FilterChipsProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {SPORT_FILTERS.map((filter) => {
        const active = value === filter;
        return (
          <TouchableOpacity
            key={filter}
            style={[
              styles.chip,
              {
                backgroundColor: active ? theme.brand.primary : theme.backgroundElement,
                borderColor: active ? theme.brand.primary : theme.border,
              },
            ]}
            onPress={() => {
              haptics.selection();
              onChange(filter);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={SPORT_LABELS[filter]}
          >
            <ThemedText
              type="caption"
              numberOfLines={1}
              style={{ color: active ? Brand.white : theme.text, fontWeight: '600' }}
            >
              {SPORT_LABELS[filter]}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    height: 36,
    flexShrink: 0,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
