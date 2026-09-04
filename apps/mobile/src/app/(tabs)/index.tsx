import { Toast } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/button';
import { Card } from '@/components/card';
import { CommentsSheet } from '@/components/comments-sheet';
import { FeedCard } from '@/components/feed-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActivityStore } from '@/stores/activityStore';
import { useSocialStore } from '@/stores/socialStore';
import { getWeeklyStats } from '@/utils/format';
import { haptics } from '@/utils/haptics';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const activities = useActivityStore((s) => s.activities);
  const getUserById = useSocialStore((s) => s.getUserById);
  const toggleKudos = useSocialStore((s) => s.toggleKudos);

  const [commentActivityId, setCommentActivityId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const weekStats = useMemo(() => {
    const weekly = getWeeklyStats(activities);
    return { count: weekly.activityCount, distance: weekly.totalDistance };
  }, [activities]);

  // Subscribe to social activities directly — useMemo recomputes when this changes
  const socialActivities = useSocialStore((s) => s.activities);
  const feed = useMemo(
    () =>
      [...socialActivities].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [socialActivities]
  );

  const onRefresh = useCallback(() => {
    haptics.selection();
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.brand.primary}
              colors={[theme.brand.primary]}
            />
          }
        >
          {/* ── Top Bar ── */}
          <ThemedView style={styles.topBar}>
            <ThemedText type="subtitle" numberOfLines={1} style={styles.greeting}>
              {getGreeting()}
            </ThemedText>
            <ThemedView style={styles.topBarActions}>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                onPress={() => Toast.show({ content: 'Notifications coming soon', duration: 1 })}
              >
                <Ionicons name="notifications-outline" size={18} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Messages"
                onPress={() => Toast.show({ content: 'Messages coming soon', duration: 1 })}
              >
                <Ionicons name="chatbubbles-outline" size={18} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Search"
                onPress={() => router.push('/search')}
              >
                <Ionicons name="search-outline" size={18} color={theme.text} />
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>

          {/* ── Week Banner ── */}
          <Animated.View entering={FadeInUp.delay(100).duration(300)}>
            <ThemedView style={[styles.weekBanner, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="flash" size={14} color={theme.brand.primary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                This week: {weekStats.count} {weekStats.count === 1 ? 'activity' : 'activities'} ·{' '}
                {formatDistanceLocal(weekStats.distance)}
              </ThemedText>
            </ThemedView>
          </Animated.View>

          {/* ── Start Activity CTA ── */}
          <Animated.View entering={FadeInUp.delay(200).duration(300)}>
            <AppButton
              icon={<Ionicons name="play" size={18} color={Brand.white} />}
              onPress={() => router.push('/(tabs)/tracking')}
              style={styles.startButton}
            >
              Start Activity
            </AppButton>
          </Animated.View>

          {/* ── Feed ── */}
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="sectionTitle">Feed</ThemedText>
            </ThemedView>

            {feed.length > 0 ? (
              feed.map((activity, index) => {
                const user = getUserById(activity.userId);
                if (!user) return null;
                return (
                  <Animated.View
                    key={activity.id}
                    entering={FadeInUp.delay(300 + index * 80).duration(300)}
                  >
                    <FeedCard
                      activity={activity}
                      user={user}
                      onKudos={() => toggleKudos(activity.id)}
                      onComment={() => setCommentActivityId(activity.id)}
                      onPress={() => router.push(`/activity-summary?id=${activity.id}`)}
                      onMapPress={() => router.push(`/activity-summary?id=${activity.id}`)}
                      onUserPress={() => router.push(`/user-profile?id=${activity.userId}`)}
                    />
                  </Animated.View>
                );
              })
            ) : (
              <Card style={styles.emptyCard}>
                <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
                <ThemedText type="sectionTitle" style={{ textAlign: 'center' }}>
                  No posts yet
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, textAlign: 'center' }}
                >
                  Activities from people you follow will appear here.
                </ThemedText>
              </Card>
            )}
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      {/* Comments sheet */}
      <CommentsSheet
        visible={commentActivityId !== null}
        activityId={commentActivityId}
        onClose={() => setCommentActivityId(null)}
      />
    </ThemedView>
  );
}

function formatDistanceLocal(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { padding: Spacing.four, gap: Spacing.three },

  /* Top Bar */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  greeting: { flex: 1, flexShrink: 1 },
  topBarActions: { flexDirection: 'row', gap: Spacing.two, flexShrink: 0 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Week Banner */
  weekBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.sm,
  },

  /* Start Button */
  startButton: { borderRadius: BorderRadius.full },

  /* Section */
  section: { gap: Spacing.two },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  /* Empty State */
  emptyCard: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
});
