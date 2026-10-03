import { StyleSheet, View } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface Props {
  items: ReadonlyArray<{ label: string; color: string }>;
}

/** Says what each territory colour on the map means. */
export function MapLegend({ items }: Props) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.legend,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
      accessible
      accessibilityLabel={`Map key: ${items.map((i) => i.label).join(', ')}`}
    >
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          <View style={[styles.swatch, { backgroundColor: item.color }]} />
          <ThemedText type="caption" themeColor="textSecondary">
            {item.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  swatch: { width: 10, height: 10, borderRadius: BorderRadius.full },
});
