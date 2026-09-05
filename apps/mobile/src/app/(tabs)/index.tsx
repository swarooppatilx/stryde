import { Toast } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/button';
import { Card } from '@/components/card';
import { CommentsSheet } from '@/components/comments-sheet';
import { FeedCard } from '@/components/feed-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing, tint } from '@/constants/theme';
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
  const socialActivities = useSocialStore((s) => s.activities);
  const fetchActivities = useSocialStore((s) => s.fetchActivities);
  const getUserById = useSocialStore((s) => s.getUserById);
  const toggleKudos = useSocialStore((s) => s.toggleKudos);

  const [commentActivityId, setCommentActivityId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const weekStats = useMemo(() => {
    const weekly = getWeeklyStats(activities);
    return { count: weekly.activityCount, distance: weekly.totalDistance };
  }, [activities]);

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
    fetchActivities().finally(() => setRefreshing(false));
  }, [fetchActivities]);

  const handleFabAction = (action: 'record' | 'manual' | 'photo') => {
    haptics.tap();
    setShowActionSheet(false);

    if (action === 'record') {
      router.push('/(tabs)/tracking');
    } else if (action === 'manual') {
      router.push('/create-activity');
    } else {
      pickPhotoForPost();
    }
  };

  const pickPhotoForPost = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to post photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const pickedPhotos = result.assets.map((a) => a.uri);
      router.push({
        pathname: '/create-activity',
        params: { photos: JSON.stringify(pickedPhotos) },
      });
    }
  };

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

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
        activeOpacity={0.8}
        onPress={() => {
          haptics.impactMedium();
          setShowActionSheet(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Create new activity"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Action Sheet Modal ── */}
      <Modal
        visible={showActionSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowActionSheet(false)}
        >
          <ThemedView
            style={[styles.actionSheet, { backgroundColor: theme.backgroundElement }]}
            onStartShouldSetResponder={() => true}
          >
            <ThemedText type="sectionTitle" style={styles.actionSheetTitle}>
              New Activity
            </ThemedText>

            <TouchableOpacity
              style={[styles.actionItem, { borderBottomColor: theme.border }]}
              activeOpacity={0.7}
              onPress={() => handleFabAction('record')}
            >
              <View
                style={[styles.actionIcon, { backgroundColor: tint(theme.brand.primary, 0.12) }]}
              >
                <Ionicons name="navigate" size={22} color={theme.brand.primary} />
              </View>
              <View style={styles.actionText}>
                <ThemedText type="smallBold">Record Activity</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  GPS tracked run, ride, or walk
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, { borderBottomColor: theme.border }]}
              activeOpacity={0.7}
              onPress={() => handleFabAction('manual')}
            >
              <View
                style={[styles.actionIcon, { backgroundColor: tint(theme.brand.success, 0.12) }]}
              >
                <Ionicons name="create-outline" size={22} color={theme.brand.success} />
              </View>
              <View style={styles.actionText}>
                <ThemedText type="smallBold">Manual Entry</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Log distance and duration
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              activeOpacity={0.7}
              onPress={() => handleFabAction('photo')}
            >
              <View style={[styles.actionIcon, { backgroundColor: tint('#8B5CF6', 0.12) }]}>
                <Ionicons name="camera" size={22} color="#8B5CF6" />
              </View>
              <View style={styles.actionText}>
                <ThemedText type="smallBold">Post Photo</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Share a photo from your activity
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </ThemedView>
        </TouchableOpacity>
      </Modal>

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

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  /* Action Sheet */
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    paddingBottom: 34,
  },
  actionSheet: {
    marginHorizontal: Spacing.four,
    borderRadius: BorderRadius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  actionSheetTitle: {
    textAlign: 'center',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
});
