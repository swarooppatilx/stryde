import { StyleSheet, View } from 'react-native';
import { shimmerPresetFor } from '@/components/Shimmer/const';
import { ShimmerEffect as Shimmer } from '@/components/Shimmer/Shimmer';
import { Feed } from '@/constants/feed';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CARDS = 2;

/** Placeholder cards (avatar, two lines, a stats row and a media block) while the first feed loads. */
export function FeedSkeleton() {
  const theme = useTheme();
  const preset = shimmerPresetFor(theme.isDark);
  return (
    <View accessibilityLabel="Loading the feed" accessibilityLiveRegion="polite">
      {Array.from({ length: CARDS }, (_, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.header}>
            <Shimmer isLoading preset={preset} style={styles.avatar} />
            <View style={styles.lines}>
              <Shimmer isLoading preset={preset} style={styles.name} />
              <Shimmer isLoading preset={preset} style={styles.meta} />
            </View>
          </View>
          <Shimmer isLoading preset={preset} style={styles.title} />
          <Shimmer isLoading preset={preset} style={styles.stats} />
          <Shimmer isLoading preset={preset} style={styles.media} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Feed.edge, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: Feed.avatar, height: Feed.avatar, borderRadius: Feed.avatar / 2 },
  lines: { flex: 1, gap: Spacing.one },
  name: { width: '45%', height: 14, borderRadius: 4 },
  meta: { width: '30%', height: 10, borderRadius: 4 },
  title: { width: '55%', height: 20, borderRadius: 4 },
  stats: { width: '80%', height: 36, borderRadius: 4 },
  media: { width: '100%', height: Feed.mediaHeight, borderRadius: 8 },
});
