import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { COPY } from '@/constants/copy';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteActivity } from '@/services/activityDeletion';
import type { Activity, ActivityType } from '@/types';
import { Alert } from '@/utils/alert';
import type { UnitSystem } from '@/utils/format';
import { countOf } from '@/utils/plural';
import { filterBySport } from '@/utils/profile';
import { Toast } from '@/utils/toast';
import { Card } from './card';
import { ChipRow } from './filter-chips';
import { ProfileActivityRow } from './profile-activity-row';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Props {
  activities: Activity[];
  sportStats: ReadonlyArray<{ type: ActivityType; count: number }>;
  unitSystem: UnitSystem;
}

function confirmDelete(activity: Activity) {
  const name = activity.name || 'Activity';
  Alert.alert(
    'Delete Activity',
    activity.onchainActivityId
      ? COPY.removeFromDevice(name)
      : `Are you sure you want to delete "${name}"?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteActivity(activity.id);
          Toast.info('Activity deleted', 1.2);
        },
      },
    ]
  );
}

/** The athlete's own activities, newest first, filterable by sport, swipe to delete. */
export function ProfileActivitiesTab({ activities, sportStats, unitSystem }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const [sportFilter, setSportFilter] = useState<ActivityType | 'all'>('all');

  // A sport you no longer have any activity in (you deleted the last one) falls back to all.
  const activeSport = sportStats.some((s) => s.type === sportFilter) ? sportFilter : 'all';
  const visible = filterBySport(activities, activeSport)
    .slice()
    .sort(
      (a, b) =>
        (b.stream?.startedAt ?? b.createdAt.getTime()) -
        (a.stream?.startedAt ?? a.createdAt.getTime())
    );
  const sportOptions = [
    { value: 'all' as const, label: 'All' },
    ...sportStats.map((s) => ({
      value: s.type,
      label: `${s.type[0]?.toUpperCase()}${s.type.slice(1)} · ${s.count}`,
    })),
  ];

  if (activities.length === 0) {
    return (
      <ThemedView style={styles.content}>
        <Card style={styles.emptyCard}>
          <Ionicons name="walk-outline" size={32} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center' }}>
            No activities yet.{'\n'}Start your first one!
          </ThemedText>
        </Card>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.content}>
      {sportStats.length > 1 && (
        <ChipRow options={sportOptions} value={activeSport} onChange={setSportFilter} />
      )}
      <ThemedText type="caption" themeColor="textSecondary">
        {countOf(visible.length, 'activity', 'activities')} · swipe to delete
      </ThemedText>
      {visible.map((activity) => (
        <ProfileActivityRow
          key={activity.id}
          activity={activity}
          unitSystem={unitSystem}
          onPress={() => router.push(`/activities/${activity.id}`)}
          onDelete={() => confirmDelete(activity)}
        />
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three },
  emptyCard: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
});
