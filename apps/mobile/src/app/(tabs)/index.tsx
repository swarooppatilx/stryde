import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { CommentsSheet } from '@/components/comments-sheet';
import { FeedCard } from '@/components/feed-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UnfoldMenu } from '@/components/unfold-menu';
import { BorderRadius, Brand, Shadow, ShadowDark, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActivityStore } from '@/stores/activityStore';
import { useProfileStore } from '@/stores/profileStore';
import { type SocialActivity, type SocialUser, useSocialStore } from '@/stores/socialStore';
import { Alert } from '@/utils/alert';
import { getWeeklyStats } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { Toast } from '@/utils/toast';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

type FeedItem = { activity: SocialActivity; user: SocialUser };

function FeedSeparator() {
  return <View style={styles.separator} />;
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const activities = useActivityStore((s) => s.activities);
  const socialActivities = useSocialStore((s) => s.activities);
  const socialUsers = useSocialStore((s) => s.users);
  const profile = useProfileStore();
  const syncLocalActivities = useSocialStore((s) => s.syncLocalActivities);
  const following = useSocialStore((s) => s.following);
  const getFeed = useSocialStore((s) => s.getFeed);
  const fetchActivities = useSocialStore((s) => s.fetchActivities);
  const getUserById = useSocialStore((s) => s.getUserById);
  const toggleKudos = useSocialStore((s) => s.toggleKudos);

  const [commentActivityId, setCommentActivityId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // The FAB floats over feed cards, so it hides while scrolling down (reading)
  // and comes back on scroll up — otherwise it permanently covers whichever
  // card's Kudos/Comment/Share row sits at the bottom of the viewport.
  const fabHidden = useSharedValue(0);
  const lastScrollY = useRef(0);
  const onFeedScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;
      if (y <= 0) fabHidden.value = withTiming(0, { duration: 180 });
      else if (delta > 6) fabHidden.value = withTiming(1, { duration: 180 });
      else if (delta < -6) fabHidden.value = withTiming(0, { duration: 180 });
    },
    [fabHidden]
  );
  const fabAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - fabHidden.value,
    transform: [{ translateY: fabHidden.value * 120 }],
  }));

  // Local saves should appear immediately, including posts not yet recorded onchain.
  // biome-ignore lint/correctness/useExhaustiveDependencies: activities triggers synchronization from the local store
  useEffect(() => {
    syncLocalActivities();
  }, [activities, syncLocalActivities]);

  const greeting = useMemo(() => getGreeting(), []);

  const weekStats = useMemo(() => {
    const weekly = getWeeklyStats(activities);
    return { count: weekly.activityCount, distance: weekly.totalDistance };
  }, [activities]);

  // getFeed() reads activities/following from the store's own get() internally,
  // so socialActivities/following are triggers for recomputation, not values read
  // in this callback — biome can't see through that closure.
  // biome-ignore lint/correctness/useExhaustiveDependencies: socialActivities/following are recompute triggers for getFeed(), not read in this callback
  const feed = useMemo(() => getFeed(), [getFeed, socialActivities, following]);
  // Activities whose author can't be resolved are skipped at render time — filter
  // them out here too, so the empty state reflects what's actually shown.
  // biome-ignore lint/correctness/useExhaustiveDependencies: getUserById reads socialUsers/profile internally
  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];
    for (const activity of feed) {
      const user = getUserById(activity.userId);
      if (user) items.push({ activity, user });
    }
    return items;
  }, [feed, getUserById, socialUsers, profile]);

  const onRefresh = useCallback(() => {
    haptics.selection();
    setRefreshing(true);
    fetchActivities().finally(() => setRefreshing(false));
  }, [fetchActivities]);

  const handleFabAction = (action?: string) => {
    haptics.tap();

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

  const renderFeedItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <Animated.View entering={FadeInUp.delay(300).duration(300)}>
        <FeedCard
          activity={item.activity}
          user={item.user}
          onKudos={() => toggleKudos(item.activity.id)}
          onComment={() => setCommentActivityId(item.activity.id)}
          onPress={() => router.push(`/activity-summary?id=${item.activity.id}`)}
          onMapPress={() => router.push(`/activity-summary?id=${item.activity.id}`)}
          onUserPress={() => router.push(`/user-profile?id=${item.activity.userId}`)}
        />
      </Animated.View>
    ),
    [toggleKudos, router]
  );

  const listHeader = useMemo(
    () => (
      <ThemedView style={styles.listHeader}>
        {/* ── Top Bar ── */}
        <ThemedView style={styles.topBar}>
          <ThemedText type="subtitle" numberOfLines={1} style={styles.greeting}>
            {greeting}
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
            <Image
              source={require('@/assets/images/stryde-emblem.png')}
              style={styles.weekBannerEmblem}
              resizeMode="contain"
            />
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
        <ThemedView style={styles.sectionHeader}>
          <ThemedText type="sectionTitle">Feed</ThemedText>
        </ThemedView>
      </ThemedView>
    ),
    [theme, greeting, weekStats, router]
  );

  // A plain empty state — the old illustration's grey placeholder rows read
  // as a feed that was still loading.
  const renderEmptyFeed = useCallback(
    () => (
      <ThemedView style={styles.emptyFeed}>
        <Ionicons name="footsteps-outline" size={36} color={theme.textSecondary} />
        <ThemedText type="sectionTitle">No posts yet</ThemedText>
        <ThemedText type="small" style={[styles.emptyFeedText, { color: theme.textSecondary }]}>
          Your activities and posts from the community will appear here.
        </ThemedText>
      </ThemedView>
    ),
    [theme]
  );

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={feedItems}
          keyExtractor={(item) => item.activity.id}
          renderItem={renderFeedItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={renderEmptyFeed}
          ItemSeparatorComponent={FeedSeparator}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={onFeedScroll}
          scrollEventThrottle={32}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.brand.primary}
              colors={[theme.brand.primary]}
            />
          }
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
      </SafeAreaView>

      {/* ── FAB ── */}
      <Animated.View style={[styles.fab, fabAnimatedStyle]}>
        <UnfoldMenu
          theme={theme.isDark ? 'dark' : 'light'}
          onSelect={handleFabAction}
          extraBottomInset={64}
          palette={{
            surface: theme.backgroundElement,
            border: tint(theme.text, theme.isDark ? 0.28 : 0.14),
            text: theme.text,
            mutedText: theme.textSecondary,
          }}
        >
          <UnfoldMenu.Trigger style={theme.isDark ? ShadowDark.lg : Shadow.lg}>
            <UnfoldMenu.Icon>
              {({ color, size }) => <Ionicons name="add" size={size} color={color} />}
            </UnfoldMenu.Icon>
            <UnfoldMenu.Label>New</UnfoldMenu.Label>
          </UnfoldMenu.Trigger>

          <UnfoldMenu.Content>
            <UnfoldMenu.Header>
              <UnfoldMenu.Title>New Activity</UnfoldMenu.Title>
              <UnfoldMenu.Close>
                {({ color, size }) => <Ionicons name="close" size={size} color={color} />}
              </UnfoldMenu.Close>
            </UnfoldMenu.Header>

            <UnfoldMenu.Grid columns={3}>
              <UnfoldMenu.Item value="record">
                <UnfoldMenu.Icon>
                  {({ color, size }) => (
                    <Ionicons name="navigate-outline" size={size} color={color} />
                  )}
                </UnfoldMenu.Icon>
                <UnfoldMenu.Label>Record</UnfoldMenu.Label>
              </UnfoldMenu.Item>

              <UnfoldMenu.Item value="manual">
                <UnfoldMenu.Icon>
                  {({ color, size }) => (
                    <Ionicons name="create-outline" size={size} color={color} />
                  )}
                </UnfoldMenu.Icon>
                <UnfoldMenu.Label>Manual</UnfoldMenu.Label>
              </UnfoldMenu.Item>

              <UnfoldMenu.Item value="photo">
                <UnfoldMenu.Icon>
                  {({ color, size }) => (
                    <Ionicons name="camera-outline" size={size} color={color} />
                  )}
                </UnfoldMenu.Icon>
                <UnfoldMenu.Label>Photo</UnfoldMenu.Label>
              </UnfoldMenu.Item>
            </UnfoldMenu.Grid>
          </UnfoldMenu.Content>
        </UnfoldMenu>
      </Animated.View>

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
  emptyFeed: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  emptyFeedText: {
    textAlign: 'center',
  },
  container: { flex: 1 },
  safeArea: { flex: 1 },
  // Bottom padding reserves room for the absolutely-positioned FAB so it
  // floats over empty space instead of sitting on top of the last card.
  scroll: { padding: Spacing.four, paddingBottom: Spacing.four + 72 },
  listHeader: { gap: Spacing.three, marginBottom: Spacing.two },

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
  weekBannerEmblem: {
    width: 10,
    height: 14,
  },

  /* Start Button */
  startButton: { borderRadius: BorderRadius.full },

  /* Section */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  /* Item separator */
  separator: {
    height: Spacing.two,
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
  },
});
