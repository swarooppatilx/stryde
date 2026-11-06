import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { ActivityStat } from '@/utils/activityStats';
import { ThemedText } from './themed-text';

interface StatRowProps {
  stats: readonly ActivityStat[];
  /** Wrap into a grid of this many equal columns instead of one row; the label stays small over the value. */
  columns?: 2;
}

/** Figures side by side (or in a two-column grid), each a small label over a bold value, left-aligned. */
export function StatRow({ stats, columns }: StatRowProps) {
  if (stats.length === 0) return null;
  const grid = columns !== undefined;
  return (
    <View style={grid ? styles.grid : styles.row}>
      {stats.map((stat) => (
        <View key={stat.label} style={grid ? styles.cell : styles.stat}>
          <ThemedText type={grid ? 'small' : 'caption'} themeColor="textSecondary">
            {stat.label}
          </ThemedText>
          <ThemedText
            type={grid ? 'title' : 'headline'}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {stat.value}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flexShrink: 1 },
  row: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.three },
  cell: { width: '50%' },
});
