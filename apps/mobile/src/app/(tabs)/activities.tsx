import { Result, SwipeAction, Toast } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_ICONS } from '@/constants/activity';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActivityStore } from '@/stores/activityStore';
import { formatArea, formatDistance, formatDuration } from '@/utils/format';

export default function ActivitiesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const activities = useActivityStore((s) => s.activities);
  const deleteActivity = useActivityStore((s) => s.deleteActivity);

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Activity', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteActivity(id);
          Toast.info('Activity deleted', 1.2);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: (typeof activities)[0] }) => {
    const icon = SPORT_ICONS[item.activityType || 'run'] || 'walk';
    const date = new Date(item.createdAt);
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    return (
      <SwipeAction
        right={[
          {
            text: 'Delete',
            color: Brand.white,
            backgroundColor: theme.brand.danger,
            onPress: () => handleDelete(item.id, item.name || 'Activity'),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.activityCard, { backgroundColor: theme.backgroundElement }]}
          onPress={() => {
            router.push(`/activity-summary?id=${item.id}`);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name={icon} size={22} color={theme.textSecondary} />
          <ThemedView style={styles.activityInfo}>
            <ThemedText type="small" style={styles.activityName}>
              {item.name || 'Activity'}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {dateStr} at {timeStr}
            </ThemedText>
            <ThemedView style={styles.activityStats}>
              <ThemedView style={styles.stat}>
                <Ionicons name="resize-outline" size={12} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {formatDistance(item.distance)}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.stat}>
                <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {formatDuration(item.duration)}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.stat}>
                <Ionicons name="map-outline" size={12} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {item.territory ? formatArea(item.territoryArea) : 'No territory'}
                </ThemedText>
              </ThemedView>
            </ThemedView>
          </ThemedView>
          <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
        </TouchableOpacity>
      </SwipeAction>
    );
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Activities</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {activities.length} {activities.length === 1 ? 'activity' : 'activities'} · swipe to
            delete
          </ThemedText>
        </ThemedView>

        {activities.length > 0 ? (
          <FlatList
            data={activities}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <Result
            style={styles.emptyState}
            img={<Ionicons name="walk-outline" size={48} color={theme.textSecondary} />}
            title="No activities yet"
            message="Start your first activity to see it here"
            buttonText="Start Activity"
            onButtonClick={() => router.push('/(tabs)/tracking')}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.sm,
    gap: Spacing.two,
  },
  activityInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  activityName: {
    fontWeight: '600',
  },
  activityStats: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
});
