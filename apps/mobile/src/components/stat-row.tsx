import { StyleSheet, View } from 'react-native';
import { Feed } from '@/constants/feed';
import type { ActivityStat } from '@/utils/activityStats';
import { ThemedText } from './themed-text';

/** Up to three figures side by side, each a small label over a bold value, left-aligned. */
export function StatRow({ stats }: { stats: readonly ActivityStat[] }) {
  if (stats.length === 0) return null;
  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.stat}>
          <ThemedText type="caption" themeColor="textSecondary">
            {stat.label}
          </ThemedText>
          <ThemedText type="headline" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
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
    gap: Feed.statGap,
    paddingHorizontal: Feed.edge,
    paddingTop: Feed.edge,
  },
});
