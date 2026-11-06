import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ActivityRecordChips } from '@/components/activity-record-chips';
import { IconBadge } from '@/components/icon-badge';
import { RouteThumbnail } from '@/components/route-thumbnail';
import { StatRow } from '@/components/stat-row';
import { ThemedText } from '@/components/themed-text';
import { getSportIcon } from '@/constants/activity';
import { Motion } from '@/constants/motion';
import { BorderRadius, IconSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { ActivityType } from '@/types';
import type { ActivityStat } from '@/utils/activityStats';
import type { RecordKind } from '@/utils/personalRecords';

const ENTER_OFFSET = Spacing.three;
const MAP_HEIGHT = 200;
const MAX_STATS = 3;

interface Props {
  name: string;
  activityType: ActivityType;
  polyline: string;
  celebration: string;
  stats: readonly ActivityStat[];
  records: readonly RecordKind[];
}

/** The just-saved activity at a glance: its route (or sport), name, a kind line, figures and any records. */
export function PostSaveHero({ name, activityType, polyline, celebration, stats, records }: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    progress.value = reduceMotion ? 1 : withTiming(1, { duration: Motion.standard });
  }, [progress, reduceMotion]);

  const entrance = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * ENTER_OFFSET }],
  }));

  return (
    <Animated.View style={[styles.hero, entrance]}>
      {polyline === '' ? (
        <IconBadge size="lg" backgroundColor={theme.brand.primaryTint} style={styles.badge}>
          <Ionicons
            name={getSportIcon(activityType)}
            size={IconSize.stat}
            color={theme.brand.primary}
          />
        </IconBadge>
      ) : (
        <View style={styles.map}>
          <RouteThumbnail polyline={polyline} height={MAP_HEIGHT} />
        </View>
      )}
      <View style={styles.text}>
        <ThemedText type="eyebrow" themeColor="textSecondary">
          Activity saved
        </ThemedText>
        <ThemedText type="display" style={styles.center}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {celebration}
        </ThemedText>
      </View>
      <StatRow stats={stats.slice(0, MAX_STATS)} />
      <ActivityRecordChips records={records} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: Spacing.three, alignSelf: 'stretch' },
  map: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  badge: { alignSelf: 'center' },
  text: { alignItems: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
});
