import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandWordmark } from '@/components/brand';
import { AppButton } from '@/components/button';
import { CommentsSheet } from '@/components/comments-sheet';
import { FeedCard } from '@/components/feed-card';
import { FeedExtraCard } from '@/components/feed-extra-card';
import { FeedSkeleton } from '@/components/feed-skeleton';
import { ChipRow } from '@/components/filter-chips';
import { GettingStartedCard } from '@/components/getting-started-card';
import { PopupMenu, type PopupMenuItem } from '@/components/popup-menu';
import { PostCard } from '@/components/post-card';
import { StaleBanner } from '@/components/stale-banner';
import { StreakCard } from '@/components/streak-card';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBarAction } from '@/components/top-bar-action';
import { UnderlineTabs } from '@/components/underline-tabs';
import { UnsyncedActivityCard } from '@/components/unsynced-activity-card';
import { SPORT_TYPES } from '@/constants/activity';
import { CREATE_MENU_COPY, FEED_OFFLINE_COPY } from '@/constants/copy';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useHiddenAuthors } from '@/hooks/useHiddenAuthors';
import { useInbox } from '@/hooks/useInbox';
import { useOnline } from '@/hooks/useOnline';
import { usePostActions } from '@/hooks/usePostActions';
import { useReportedHidden } from '@/hooks/useReportedHidden';
import { useUserResolver } from '@/hooks/useSocialUser';
import { useUnsavedRunPrompt } from '@/hooks/useUnsavedRunPrompt';
import { getPlatform } from '@/platform';
import { useActivityStore } from '@/stores/activityStore';
import { useBlockStore } from '@/stores/blockStore';
import { useClubStore } from '@/stores/clubStore';
import { useCommunityStore } from '@/stores/communityStore';
import { useFeedPrefsStore } from '@/stores/feedPrefsStore';
import { useGoalsStore } from '@/stores/goalsStore';
import { usePostStore } from '@/stores/postStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { selectAccountSetup, useSetupStore } from '@/stores/setupStore';
import {
  type SocialActivity,
  type SocialUser,
  useSocialStore,
  visibleActivities,
} from '@/stores/socialStore';
import type { Activity } from '@/types';
import { achievementsEarnedBy } from '@/utils/achievements';
import { sameAddress } from '@/utils/address';
import { Alert } from '@/utils/alert';
import { confirmDeletePost } from '@/utils/confirmDeletePost';
import { confirmSkipSetup } from '@/utils/confirmSkipSetup';
import {
  CARD_GAP,
  type FeedExtraCard as ExtraCard,
  interleaveCards,
  pickChallengeCard,
  pickClubCard,
  pickSuggestedCard,
} from '@/utils/feedCards';
import {
  effectiveSport,
  FEED_ORDER_LABEL,
  filterBySport,
  orderFeed,
  type SportChoice,
  sportsInFeed,
} from '@/utils/feedView';
import { type ChecklistId, checklistVisible, deriveChecklist } from '@/utils/gettingStarted';
import { haptics } from '@/utils/haptics';
import { loadFailureView } from '@/utils/loadFailureView';
import { isScrolledDown, latestTime, shouldShowNewItemsPill } from '@/utils/newItemsPill';
import { nextVisibleCount } from '@/utils/pageSize';
import type { Box } from '@/utils/popupPosition';
import { mergeByTime, type PostEntry, postAuthors, postsForScope } from '@/utils/postFeed';
import { DEFAULT_SETTINGS } from '@/utils/profile';
import { shouldRefreshOnReconnect } from '@/utils/reconnectRefresh';
import { withoutReportedIds } from '@/utils/reporting';
import {
  FEED_SCOPES,
  type FeedScope,
  filterFeed,
  withoutMutedFromOthers,
} from '@/utils/socialFeed';
import { Toast } from '@/utils/toast';
import type { WeekStartDay } from '@/utils/trainingLog';
import { unsyncedActivities } from '@/utils/unsyncedActivities';
import { goalsChanged } from '@/utils/weeklyGoals';
import { loggedThisWeek, weeklyStreak } from '@/utils/weeklyStreak';
import { withoutHidden } from '@/utils/withoutHidden';

/** Feed items shown at a time; more load as the reader reaches the end. */
const FEED_PAGE_SIZE = 10;

const TOP_BAR_WORDMARK = 104;

const CLUB_FEEDS_LOADED = 3;

type FeedItem =
  | { kind: 'activity'; activity: SocialActivity; user: SocialUser }
  | { kind: 'post'; post: PostEntry; user: SocialUser };

type ListItem = FeedItem | { kind: 'card'; card: ExtraCard };

const listItemKey = (item: ListItem) => (item.kind === 'card' ? item.card.id : itemKey(item));
const itemKey = (item: FeedItem) => (item.kind === 'post' ? item.post.id : item.activity.id);
const itemTime = (item: FeedItem) =>
  item.kind === 'post' ? item.post.createdAt : item.activity.createdAt.getTime() / 1000;
const itemSport = (item: FeedItem) =>
  item.kind === 'activity' ? item.activity.activityType : undefined;
const itemAuthor = (item: FeedItem) =>
  item.kind === 'post' ? item.post.author : item.activity.userId;

const SPORT_LABEL = Object.fromEntries(SPORT_TYPES.map((s) => [s.type, s.label]));

function FeedSeparator() {
  return <View style={styles.separator} />;
}

const EMPTY_FEED_TEXT: Record<FeedScope, string> = {
  Everyone: 'Your activities and posts from the community will appear here.',
  Following: 'Follow athletes to see their runs and rides here.',
  You: 'Activities you record will appear here.',
};

function streakSummary(
  activities: readonly Pick<Activity, 'createdAt'>[],
  weekStartsOn: WeekStartDay
): { weeks: number; doneThisWeek: boolean } {
  const now = new Date();
  return {
    weeks: weeklyStreak(activities, now, weekStartsOn),
    doneThisWeek: loggedThisWeek(activities, now, weekStartsOn),
  };
}

function mergeFeedItems({
  activities,
  posts,
  skipIds,
  resolveUser,
}: {
  activities: SocialActivity[];
  posts: PostEntry[];
  skipIds: ReadonlySet<string>;
  resolveUser: (id: string) => SocialUser | undefined;
}): FeedItem[] {
  const items: FeedItem[] = [];
  for (const activity of activities) {
    if (skipIds.has(activity.id)) continue;
    const user = resolveUser(activity.userId);
    if (user) items.push({ kind: 'activity', activity, user });
  }
  const postItems: FeedItem[] = [];
  for (const post of posts) {
    const user = resolveUser(post.author);
    if (user) postItems.push({ kind: 'post', post, user });
  }
  return mergeByTime(items, postItems, itemTime);
}

export default function HomeScreen() {
  const router = useRouter();
  useUnsavedRunPrompt();
  const theme = useTheme();
  const activities = useActivityStore((s) => s.activities);
  const socialActivities = useSocialStore((s) => s.activities);
  const syncLocalActivities = useSocialStore((s) => s.syncLocalActivities);
  const following = useSocialStore((s) => s.following);
  const fetchActivities = useSocialStore((s) => s.fetchActivities);
  const feedStatus = useSocialStore((s) => s.feedStatus);
  const resolveUser = useUserResolver();
  const toggleKudos = useSocialStore((s) => s.toggleKudos);

  const posts = usePostStore((s) => s.posts);
  const postList = Object.values(posts).sort((a, b) => b.createdAt - a.createdAt);
  const fetchPosts = usePostStore((s) => s.fetchPosts);
  const users = useSocialStore((s) => s.users);
  const { remove: removeOwnPost } = usePostActions();

  const [commentActivityId, setCommentActivityId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Local saves should appear immediately, including posts not yet recorded onchain.
  // biome-ignore lint/correctness/useExhaustiveDependencies: activities triggers synchronization from the local store
  useEffect(() => {
    syncLocalActivities();
  }, [activities, syncLocalActivities]);

  const weekStartsOn = useSettingsStore((s) => s.weekStartsOn);
  const streak = streakSummary(activities, weekStartsOn);

  const me = useCurrentUserId();
  const setup = useSetupStore(selectAccountSetup(me));
  const dismissChecklist = useSetupStore((s) => s.dismissChecklist);
  const profileSettings = useProfileStore((s) => s.settings);
  const hasPhoto = useProfileStore((s) => s.avatar !== null);
  const goalsTouched = useGoalsStore((s) => s.touched);
  const checklist = deriveChecklist({
    activityCount: activities.length,
    goalSet: setup.goalChosen || goalsTouched || goalsChanged(profileSettings, DEFAULT_SETTINGS),
    followingCount: following.size,
    hasPhoto,
  });
  const openChecklistItem = (id: ChecklistId) => {
    if (id === 'activity') router.push('/(tabs)/tracking');
    else if (id === 'goal') router.push('/goals');
    else if (id === 'follow') router.push('/search');
    else router.push('/profile-edit');
  };
  const [scope, setScope] = useState<FeedScope>('Everyone');
  const [sportChoice, setSportChoice] = useState<SportChoice>('all');
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);
  const hidden = useHiddenAuthors();
  const reportedActivities = useReportedHidden().activities;
  const hiddenFromHome = useBlockStore((s) => s.hiddenFromHome);
  const feed = filterFeed(
    withoutMutedFromOthers(
      withoutReportedIds(
        withoutHidden(
          visibleActivities(Object.values(socialActivities), me, following),
          (a) => a.userId,
          hidden
        ),
        (a) => a.id,
        [...reportedActivities, ...hiddenFromHome]
      ),
      me
    ),
    scope,
    me,
    following
  );
  // Saved on this device but not on the chain: shown first, with a way to try again. They are also
  // merged into the feed, so the feed leaves them out rather than showing each run twice.
  const unsynced = unsyncedActivities(activities);
  const unsyncedIds = new Set(unsynced.map((a) => a.id));

  // Activities whose author can't be resolved are skipped at render time — filter
  // them out here too, so the empty state reflects what's actually shown.
  const visiblePosts = withoutHidden(
    postsForScope(postList, scope, me, following),
    (p) => p.author,
    hidden
  );
  const feedItems = mergeFeedItems({
    activities: feed,
    posts: visiblePosts,
    skipIds: unsyncedIds,
    resolveUser,
  });

  // Sport chips offer what is in this scope's feed; a chosen sport that has left it reads as All.
  const sportsPresent = sportsInFeed(feedItems, itemSport);
  const sport = effectiveSport(sportChoice, sportsPresent);
  const feedOrder = useFeedPrefsStore((s) => s.order);
  const setFeedOrder = useFeedPrefsStore((s) => s.setOrder);
  const orderedItems = orderFeed(
    filterBySport(feedItems, sport, itemSport),
    scope === 'Everyone' ? feedOrder : 'latest',
    (item) => following.has(itemAuthor(item).toLowerCase())
  );
  const dismissedCards = useFeedPrefsStore((s) => s.dismissedCards);
  const dismissCard = useFeedPrefsStore((s) => s.dismissCard);
  const clubs = useCommunityStore((s) => s.clubs);
  const joinedClubIds = useCommunityStore((s) => s.joinedClubIds);
  const events = useCommunityStore((s) => s.events);
  const joinedEvents = useCommunityStore((s) => s.joinedEvents);
  const clubViews = useClubStore((s) => s.clubs);
  const loadClub = useClubStore((s) => s.load);
  // The joined clubs' feeds are fetched per club; the first few are enough for one card.
  // biome-ignore lint/correctness/useExhaustiveDependencies: load once per set of joined clubs
  useEffect(() => {
    for (const id of joinedClubIds.slice(0, CLUB_FEEDS_LOADED)) {
      const view = useClubStore.getState().view(id);
      if (!view.state && !view.loading) void loadClub(id);
    }
  }, [joinedClubIds.join(',')]);
  const extraCards: ExtraCard[] = [];
  const clubFeeds = Object.fromEntries(Object.entries(clubViews).map(([id, v]) => [id, v.feed]));
  const clubCard = pickClubCard(clubs, joinedClubIds, clubFeeds, dismissedCards);
  const challengeCard = pickChallengeCard(
    events,
    joinedEvents,
    activities,
    new Date(),
    dismissedCards
  );
  const suggestedCard = pickSuggestedCard(users, following, me, hidden, dismissedCards);
  for (const card of [challengeCard, clubCard, suggestedCard]) if (card) extraCards.push(card);
  // Cards only break up the open feed: a sport filter or a narrower tab is a deliberate view.
  const showCards = scope === 'Everyone' && sport === 'all';
  const listItems: ListItem[] = showCards
    ? interleaveCards<ListItem, ListItem>(
        orderedItems,
        extraCards.map((card) => ({ kind: 'card' as const, card })),
        CARD_GAP
      )
    : orderedItems;
  const sportOptions = [
    { value: 'all' as SportChoice, label: 'All sports' },
    ...sportsPresent.map((type) => ({
      value: type as SportChoice,
      label: SPORT_LABEL[type] ?? type,
    })),
  ];

  // The newest item the reader has seen at the top; a refresh past it while scrolled away shows the pill.
  const newestTime = latestTime(feedItems.map(itemTime));
  const listRef = useRef<FlatList<ListItem>>(null);
  const seenTop = useRef<number | null>(null);
  const [scrolledDown, setScrolledDown] = useState(false);
  const [newPill, setNewPill] = useState(false);
  useEffect(() => {
    if (!scrolledDown || seenTop.current === null) {
      seenTop.current = newestTime;
      setNewPill(false);
      return;
    }
    setNewPill(
      shouldShowNewItemsPill({ anchorTime: seenTop.current, latestTime: newestTime, scrolledDown })
    );
  }, [newestTime, scrolledDown]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const down = isScrolledDown(e.nativeEvent.contentOffset.y);
    if (down !== scrolledDown) setScrolledDown(down);
  };
  const showNewItems = () => {
    haptics.tap();
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewPill(false);
  };

  const pagedItems = listItems.slice(0, visibleCount);
  const loadMore = () =>
    setVisibleCount((count) => nextVisibleCount(count, listItems.length, FEED_PAGE_SIZE));
  const changeScope = (next: FeedScope) => {
    setScope(next);
    setVisibleCount(FEED_PAGE_SIZE);
    // A different feed's newest item says nothing about what arrived.
    seenTop.current = null;
  };
  const changeSport = (next: SportChoice) => {
    setSportChoice(next);
    setVisibleCount(FEED_PAGE_SIZE);
  };

  const online = useOnline();
  // A feed that failed to load comes back by itself when the connection does.
  const wasOnline = useRef(online);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of connection is the trigger
  useEffect(() => {
    if (shouldRefreshOnReconnect({ wasOnline: wasOnline.current, online, feedStatus })) {
      void fetchActivities();
    }
    wasOnline.current = online;
  }, [online]);

  const loadPosts = () =>
    fetchPosts(postAuthors(me, following, Object.keys(users)) as `0x${string}`[]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: load once per set of known athletes, not on every list change
  useEffect(() => {
    void loadPosts();
  }, [me, following.size, Object.keys(users).length]);

  const onRefresh = async () => {
    haptics.selection();
    setRefreshing(true);
    // Wait for the posts as well, so the spinner does not stop while half the feed is still coming.
    const [posts, activities] = await Promise.allSettled([loadPosts(), fetchActivities()]);
    if (posts.status === 'rejected' || (activities.status === 'fulfilled' && !activities.value)) {
      Toast.fail("Couldn't refresh. Showing what you already have.", 2);
    }
    setRefreshing(false);
  };

  const pickPhotoForPost = async () => {
    const result = await getPlatform().photos.pick({ multiple: true });
    if (result.status === 'denied') {
      Alert.alert('Permission needed', 'Photo library access is required to post photos.');
      return;
    }

    if (result.uris.length > 0) {
      const pickedPhotos = result.uris;
      router.push({
        pathname: '/create-activity',
        params: { photos: JSON.stringify(pickedPhotos) },
      });
    }
  };

  // The menu hangs off the "+" button, so where that button is on screen is measured when it opens.
  const createButtonRef = useRef<View>(null);
  const [createAnchor, setCreateAnchor] = useState<Box | null>(null);
  const openCreateMenu = () => {
    haptics.tap();
    createButtonRef.current?.measureInWindow((x, y, width, height) =>
      setCreateAnchor({ x, y, width, height })
    );
  };
  const createItems: PopupMenuItem[] = [
    {
      key: 'post',
      label: CREATE_MENU_COPY.post,
      icon: 'create-outline',
      onPress: () => router.push('/create-post'),
    },
    {
      key: 'photo',
      label: CREATE_MENU_COPY.photo,
      icon: 'image-outline',
      onPress: pickPhotoForPost,
    },
    {
      key: 'manual',
      label: CREATE_MENU_COPY.manual,
      icon: 'pencil-outline',
      onPress: () => router.push('/create-activity'),
    },
  ];

  // Badges each of the viewer's own activities earned, for the notice under its card.
  const earnedByActivity = achievementsEarnedBy(activities);

  // The list re-mounts cards as they scroll in and out; only a post's first appearance animates.
  const animatedPosts = useRef(new Set<string>());
  const renderFeedItem = ({ item, index }: { item: ListItem; index: number }) => {
    if (item.kind === 'card') {
      return <FeedExtraCard card={item.card} onDismiss={() => dismissCard(item.card.id)} />;
    }
    const key = itemKey(item);
    const firstTime = !animatedPosts.current.has(key);
    animatedPosts.current.add(key);
    if (item.kind === 'post') {
      const own = sameAddress(item.post.author, me);
      return (
        <Animated.View
          entering={firstTime ? FadeInUp.delay(Math.min(index, 5) * 60).duration(300) : undefined}
        >
          <PostCard
            post={item.post}
            name={item.user.username}
            avatarUri={item.user.avatar}
            verified={item.user.isVerified}
            onUserPress={() => router.push(`/athletes/${item.post.author}`)}
            onDelete={own ? () => confirmDeletePost(() => removeOwnPost(item.post.id)) : undefined}
          />
        </Animated.View>
      );
    }
    return (
      <Animated.View
        entering={firstTime ? FadeInUp.delay(Math.min(index, 5) * 60).duration(300) : undefined}
      >
        <FeedCard
          activity={item.activity}
          user={item.user}
          onKudos={() => toggleKudos(item.activity.id)}
          onComment={() => setCommentActivityId(item.activity.id)}
          onPress={() => router.push(`/activities/${item.activity.id}`)}
          onMapPress={() => router.push(`/activities/${item.activity.id}`)}
          onUserPress={() => router.push(`/athletes/${item.activity.userId}`)}
          earned={earnedByActivity.get(item.activity.id)}
        />
      </Animated.View>
    );
  };

  const { unread: unreadCount } = useInbox();

  // A failed refresh over posts already on the phone keeps them and says so above the feed.
  const feedFailureView = loadFailureView({
    failed: feedStatus === 'error',
    hasCached: feedItems.length > 0,
  });

  const listHeader = (
    <ThemedView style={styles.listHeader}>
      <ThemedView style={styles.topBar}>
        <BrandWordmark width={TOP_BAR_WORDMARK} color={theme.text} />
        <ThemedView style={styles.topBarActions}>
          <View ref={createButtonRef} collapsable={false}>
            <TopBarAction icon="add" label="Create" onPress={openCreateMenu} />
          </View>
          <TopBarAction
            icon="search-outline"
            label="Search"
            onPress={() => router.push('/search')}
          />
          <TopBarAction
            icon="notifications-outline"
            label={unreadCount > 0 ? `Notifications, ${unreadCount} new` : 'Notifications'}
            onPress={() => router.push('/inbox')}
          >
            {unreadCount > 0 ? (
              <View style={[styles.unreadBadge, { backgroundColor: theme.brand.danger }]}>
                <ThemedText type="eyebrow" style={styles.unreadText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </ThemedText>
              </View>
            ) : null}
          </TopBarAction>
        </ThemedView>
      </ThemedView>

      {!online && (
        <ThemedView style={[styles.offlineBanner, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={theme.textSecondary} />
          <ThemedText type="caption" themeColor="textSecondary">
            You're offline. Showing what's saved on this device.
          </ThemedText>
        </ThemedView>
      )}

      {checklistVisible(checklist, setup.checklistDismissed) && (
        <GettingStartedCard
          items={checklist}
          onOpen={openChecklistItem}
          onDismiss={() => confirmSkipSetup(() => dismissChecklist(me))}
        />
      )}
      <StreakCard
        weeks={streak.weeks}
        doneThisWeek={streak.doneThisWeek}
        onRecord={() => router.push('/(tabs)/tracking')}
      />
      <UnderlineTabs<FeedScope>
        tabs={FEED_SCOPES}
        active={scope}
        onChange={changeScope}
        style={styles.inset}
      />
      {sportsPresent.length > 1 && (
        <ChipRow
          options={sportOptions}
          value={sport}
          onChange={changeSport}
          contentStyle={styles.chipInset}
        />
      )}
      {scope === 'Everyone' && sportsPresent.length > 0 && (
        <Tappable
          onPress={() => {
            haptics.selection();
            setFeedOrder(feedOrder === 'latest' ? 'following_first' : 'latest');
          }}
          style={[styles.inset, styles.orderRow]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Order: ${FEED_ORDER_LABEL[feedOrder]}. Change the order`}
        >
          <Ionicons name="swap-vertical" size={16} color={theme.textSecondary} />
          <ThemedText type="caption" themeColor="textSecondary">
            {FEED_ORDER_LABEL[feedOrder]}
          </ThemedText>
        </Tappable>
      )}
      {unsynced.map((activity) => (
        <View key={activity.id} style={styles.inset}>
          <UnsyncedActivityCard activity={activity} />
        </View>
      ))}
    </ThemedView>
  );

  // Placeholder rows would read as a feed still loading, so the empty state is plain.
  const renderEmptyFeed = () => {
    if (feedStatus === 'idle' || feedStatus === 'loading') return <FeedSkeleton />;
    if (feedStatus === 'error') {
      // Recording needs no connection and is sent later, so the way forward is offered, not just an error.
      return (
        <ThemedView style={styles.emptyFeed}>
          <Ionicons name="cloud-offline-outline" size={36} color={theme.textSecondary} />
          <ThemedText type="sectionTitle">{FEED_OFFLINE_COPY.title}</ThemedText>
          <ThemedText type="small" style={[styles.emptyFeedText, { color: theme.textSecondary }]}>
            {FEED_OFFLINE_COPY.body}
          </ThemedText>
          <AppButton onPress={() => router.push('/(tabs)/tracking')}>
            {FEED_OFFLINE_COPY.record}
          </AppButton>
          <AppButton variant="secondary" onPress={() => void fetchActivities()}>
            {FEED_OFFLINE_COPY.retry}
          </AppButton>
        </ThemedView>
      );
    }
    return (
      <ThemedView style={styles.emptyFeed}>
        <Ionicons name="footsteps-outline" size={36} color={theme.textSecondary} />
        <ThemedText type="sectionTitle">No posts yet</ThemedText>
        <ThemedText type="small" style={[styles.emptyFeedText, { color: theme.textSecondary }]}>
          {EMPTY_FEED_TEXT[scope]}
        </ThemedText>
        {scope === 'Following' ? (
          <AppButton variant="secondary" onPress={() => router.push('/search')}>
            Find athletes
          </AppButton>
        ) : (
          <AppButton variant="secondary" onPress={() => router.push('/(tabs)/tracking')}>
            Record your first activity
          </AppButton>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <PopupMenu
        anchor={createAnchor}
        items={createItems}
        onClose={() => setCreateAnchor(null)}
        accessibilityLabel={CREATE_MENU_COPY.menu}
      />
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          ref={listRef}
          data={pagedItems}
          onScroll={onScroll}
          scrollEventThrottle={100}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          keyExtractor={listItemKey}
          renderItem={renderFeedItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={renderEmptyFeed}
          ListFooterComponent={
            visibleCount < listItems.length ? (
              <ActivityIndicator style={styles.footer} color={theme.brand.primary} />
            ) : null
          }
          ItemSeparatorComponent={FeedSeparator}
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
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
        {feedFailureView === 'banner' && (
          // An overlay, not a row in the list: arriving after the first paint, a row would push the whole feed down.
          <Animated.View entering={FadeInDown.duration(200)} style={styles.staleWrap}>
            <StaleBanner onRetry={() => void fetchActivities()} />
          </Animated.View>
        )}
        {newPill && (
          <Animated.View entering={FadeInUp.duration(200)} style={styles.pillWrap}>
            <Tappable
              onPress={showNewItems}
              style={[styles.pill, { backgroundColor: theme.brand.primary }]}
              accessibilityRole="button"
              accessibilityLabel="New activities. Scroll to the top"
            >
              <Ionicons name="arrow-up" size={14} color={Brand.white} />
              <ThemedText type="caption" style={styles.pillText}>
                New activities
              </ThemedText>
            </Tappable>
          </Animated.View>
        )}
      </SafeAreaView>

      <CommentsSheet
        visible={commentActivityId !== null}
        activityId={commentActivityId}
        onClose={() => setCommentActivityId(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  footer: { paddingVertical: Spacing.three },
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
  // Entries and the streak module run edge to edge; the rows that are not full-width carry their own inset.
  scroll: { paddingTop: Spacing.two, paddingBottom: Spacing.four },
  inset: { paddingHorizontal: Spacing.four },
  chipInset: { paddingHorizontal: Spacing.four },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, alignSelf: 'flex-end' },
  pillWrap: { position: 'absolute', top: Spacing.three, left: 0, right: 0, alignItems: 'center' },
  staleWrap: {
    position: 'absolute',
    bottom: Spacing.three,
    left: Spacing.four,
    right: Spacing.four,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
  },
  pillText: { color: Brand.white, fontWeight: '600' },
  listHeader: { gap: Spacing.three, marginBottom: Spacing.two },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  topBarActions: { flexDirection: 'row', gap: Spacing.two, flexShrink: 0 },
  unreadBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: Spacing.one,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { color: Brand.white, fontSize: 10, lineHeight: 12, letterSpacing: 0 },

  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm,
    marginHorizontal: Spacing.four,
  },

  separator: {
    height: Spacing.two,
  },
});
