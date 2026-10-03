import { SwipeAction } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { Tappable } from '@/components/tappable';
import { SPORT_ICONS } from '@/constants/activity';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Activity } from '@/types';
import { formatTimeOfDay, formatWeekdayDay } from '@/utils/dates';
import { formatArea, formatDistance, formatDuration, type UnitSystem } from '@/utils/format';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Props {
  activity: Activity;
  unitSystem: UnitSystem;
  onPress(): void;
  /** Swipe-to-delete; the caller confirms with the user. */
  onDelete(): void;
}

function RowStat({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.stat}>
      <Ionicons name={icon} size={12} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
    </ThemedView>
  );
}

export function ProfileActivityRow({ activity, unitSystem, onPress, onDelete }: Props) {
  const theme = useTheme();
  const startedAt = activity.stream?.startedAt ?? activity.createdAt;
  const icon = (SPORT_ICONS[activity.activityType] ||
    'walk-outline') as keyof typeof Ionicons.glyphMap;

  return (
    <SwipeAction
      right={[
        {
          text: 'Delete',
          color: Brand.white,
          backgroundColor: theme.brand.danger,
          onPress: onDelete,
        },
      ]}
    >
      <Tappable
        style={[styles.card, { backgroundColor: theme.backgroundElement }]}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        <Ionicons name={icon} size={22} color={theme.textSecondary} />
        <ThemedView style={styles.info}>
          <ThemedText type="small" style={styles.name}>
            {activity.name || 'Activity'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatWeekdayDay(startedAt)} at {formatTimeOfDay(startedAt)}
          </ThemedText>
          <ThemedView style={styles.stats}>
            <RowStat icon="resize-outline" text={formatDistance(activity.distance, unitSystem)} />
            <RowStat icon="time-outline" text={formatDuration(activity.duration)} />
            {activity.territory ? (
              <RowStat icon="map-outline" text={formatArea(activity.territoryArea, unitSystem)} />
            ) : null}
          </ThemedView>
        </ThemedView>
        <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
      </Tappable>
    </SwipeAction>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.sm,
    gap: Spacing.two,
  },
  info: { flex: 1, gap: Spacing.half },
  name: { fontWeight: '600' },
  stats: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.one },
  stat: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
