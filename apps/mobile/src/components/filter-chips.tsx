import { ScrollView, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { Tappable } from '@/components/tappable';
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

interface ChipRowProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  /** Extra padding for the scrolling content, such as a side inset. */
  contentStyle?: StyleProp<ViewStyle>;
}

/** A horizontally scrolling row of pill buttons, one selected. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  contentStyle,
}: ChipRowProps<T>) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, contentStyle]}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Tappable
            key={option.value}
            style={[
              styles.chip,
              {
                backgroundColor: active ? theme.brand.primary : theme.backgroundElement,
                borderColor: active ? theme.brand.primary : theme.border,
              },
            ]}
            onPress={() => {
              haptics.selection();
              onChange(option.value);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <ThemedText
              type="caption"
              numberOfLines={1}
              style={{ color: active ? Brand.white : theme.text, fontWeight: '600' }}
            >
              {option.label}
            </ThemedText>
          </Tappable>
        );
      })}
    </ScrollView>
  );
}

const SPORT_OPTIONS = SPORT_FILTERS.map((value) => ({ value, label: SPORT_LABELS[value] }));

interface FilterChipsProps {
  value: SportFilter;
  onChange: (filter: SportFilter) => void;
}

export function FilterChips({ value, onChange }: FilterChipsProps) {
  return <ChipRow options={SPORT_OPTIONS} value={value} onChange={onChange} />;
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
