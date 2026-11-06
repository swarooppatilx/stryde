import { StyleSheet, View } from 'react-native';
import { RouteThumbnail } from '@/components/route-thumbnail';
import { StatRow } from '@/components/stat-row';
import { ThemedText } from '@/components/themed-text';
import { GPS_DISTANCE_SPORTS } from '@/constants/activity';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityType } from '@/types';
import type { ActivityStat } from '@/utils/activityStats';
import {
  formatArea,
  formatDistance,
  formatDuration,
  formatPaceOrSpeed,
  showsSpeed,
  type UnitSystem,
} from '@/utils/format';

/** Tall enough to read the route's shape, short enough that the form stays in view. */
const MAP_PREVIEW_HEIGHT = 180;

interface Props {
  polyline: string;
  activityType: ActivityType;
  distance: number;
  duration: number;
  territoryArea: number;
  unitSystem: UnitSystem;
}

function summaryStats({
  activityType,
  distance,
  duration,
  unitSystem,
}: Omit<Props, 'polyline' | 'territoryArea'>): ActivityStat[] {
  const stats: ActivityStat[] = [
    { label: 'Distance', value: formatDistance(distance, unitSystem) },
    { label: 'Time', value: formatDuration(duration) },
  ];
  if (GPS_DISTANCE_SPORTS.has(activityType) && distance > 0 && duration > 0) {
    stats.push({
      label: showsSpeed(activityType) ? 'Speed' : 'Pace',
      value: formatPaceOrSpeed(activityType, distance, duration, unitSystem),
    });
  }
  return stats;
}

/** The recorded run at a glance: the route on a map, with distance, time and pace under it. */
export function RouteSummary({ polyline, territoryArea, ...rest }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      {polyline !== '' && (
        // A preview for the athlete only: hiding the route from others changes what is published, not this.
        <RouteThumbnail polyline={polyline} height={MAP_PREVIEW_HEIGHT} />
      )}
      <StatRow stats={summaryStats(rest)} />
      {territoryArea > 0 && (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.territory}>
          Territory {formatArea(territoryArea, rest.unitSystem)}
        </ThemedText>
      )}
      <View style={styles.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  territory: { paddingHorizontal: Spacing.three, paddingTop: Spacing.one },
  bottom: { height: Spacing.three },
});
