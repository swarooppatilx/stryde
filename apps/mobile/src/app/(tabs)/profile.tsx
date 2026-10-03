import { List } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AboutLines } from '@/components/about-lines';
import { AchievementBadge } from '@/components/achievement-badge';
import { BadgeGrid } from '@/components/badge-grid';
import { FollowCounts } from '@/components/follow-counts';
import { GoalsCard } from '@/components/goals-card';
import { ListIcon } from '@/components/list-icon';
import { ProfileActions } from '@/components/profile-actions';
import { ProfileActivitiesTab } from '@/components/profile-activities-tab';
import { ProfileHero } from '@/components/profile-header';
import { ProfilePosts } from '@/components/profile-posts';
import { ProfileStatLists } from '@/components/profile-stat-lists';
import { ProfileTotals, WalletPills } from '@/components/profile-summary';
import { QrSheet } from '@/components/qr-sheet';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBarAction } from '@/components/top-bar-action';
import { TrainingLog } from '@/components/training-log';
import { UnderlineTabs } from '@/components/underline-tabs';
import { WeeklyProgressCard } from '@/components/weekly-progress-card';
import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useAchievementBadges, useTerritoryNfts } from '@/hooks/useAutoMint';
import { useAvatarEdit } from '@/hooks/useAvatarEdit';
import { useBalances } from '@/hooks/useBalances';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useEnsAvatar, useEnsName } from '@/hooks/useEnsName';
import { useGoals } from '@/hooks/useGoals';
import { useProfileStats } from '@/hooks/useProfileStats';
import { useSocialUser } from '@/hooks/useSocialUser';
import { useTerritorySummary } from '@/hooks/useTerritorySummary';
import { useUsernameEdit } from '@/hooks/useUsernameEdit';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useWorldVerification } from '@/hooks/useWorldVerification';
import { territoryService } from '@/services/territoryService';
import { useActivityStore } from '@/stores/activityStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSocialStore } from '@/stores/socialStore';
import { resolveAvatarUri } from '@/utils/avatarUri';
import { formatMonthYear } from '@/utils/dates';
import { buildProfileDeepLink } from '@/utils/deepLink';
import { chooseEnsIdentity } from '@/utils/ensIdentity';
import { formatArea, formatDistance, formatDuration, getDisplayName } from '@/utils/format';
import { weeklyTargets } from '@/utils/goals';
import { logger } from '@/utils/logger';
import { activityCountLine } from '@/utils/profileSubline';
import { Toast } from '@/utils/toast';

const TABS = ['Progress', 'Activities', 'More'] as const;
const TAB_ICONS: Record<(typeof TABS)[number], keyof typeof Ionicons.glyphMap> = {
  Progress: 'stats-chart',
  Activities: 'pulse',
  More: 'menu',
};
type TabKey = (typeof TABS)[number];

/** Badges shown on the Progress tab before "See all". */
const ACHIEVEMENT_PREVIEW = 3;

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const username = useProfileStore((s) => s.username);
  const avatar = useProfileStore((s) => s.avatar);
  const avatarCid = useProfileStore((s) => s.avatarCid);
  const createdAt = useProfileStore((s) => s.createdAt);
  const weeklyGoalDistance = useProfileStore((s) => s.settings.weeklyGoalDistance);
  const weeklyGoalActivities = useProfileStore((s) => s.settings.weeklyGoalActivities);
  const weeklyGoalTime = useProfileStore((s) => s.settings.weeklyGoalTime);
  const goals = useGoals();
  const _setAvatar = useProfileStore((s) => s.setAvatar);
  const _setAvatarCid = useProfileStore((s) => s.setAvatarCid);
  const activities = useActivityStore((s) => s.activities);
  const currentUserId = useCurrentUserId();
  const { totalArea: totalTerritoryArea, polygons: userPolygons } =
    useTerritorySummary(currentUserId);
  const { wallet, address } = useViemWallet();
  const me = useSocialUser(currentUserId);
  const { isVerified } = useWorldVerification();

  const [activeTab, setActiveTab] = useState<TabKey>('Progress');
  const nameEdit = useUsernameEdit();

  // The on-chain identity address (from useViemWallet), not the Privy embedded
  // auth wallet — in local dev mode these differ.
  const walletAddress = address;
  const ensName = useEnsName(walletAddress);
  const { ensLine, fallbackAvatar } = chooseEnsIdentity({
    ensName,
    ensAvatar: useEnsAvatar(ensName),
    hasOwnAvatar: !!avatar,
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivities = useSocialStore((s) => s.fetchActivities);
  const syncFollowing = useSocialStore((s) => s.syncFollowing);
  const loadAbout = useSocialStore((s) => s.loadAbout);
  const balances = useBalances(walletAddress);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Everything this screen shows: balances, the athlete's feed, follow counts and their bio.
      const results = await Promise.allSettled([
        balances.refresh(),
        fetchActivities(),
        walletAddress ? syncFollowing(walletAddress as `0x${string}`) : undefined,
        walletAddress ? loadAbout([walletAddress]) : undefined,
      ]);
      // One part failing must not hide the rest, and the athlete should hear that it did.
      if (results.some((result) => result.status === 'rejected')) {
        Toast.fail('Could not refresh everything. Pull down to try again.', 2);
      }
    } finally {
      setRefreshing(false);
    }
  }, [balances.refresh, fetchActivities, syncFollowing, loadAbout, walletAddress]);

  const {
    totalDistance,
    totalDuration,
    weekly: weeklyStats,
    sports: sportStats,
    unlockedAchievements,
    streak,
    records,
  } = useProfileStats(activities, totalTerritoryArea);

  const mintedAchievementIds = useAchievementBadges({ wallet, address }, unlockedAchievements);
  const mintedTerritoryIds = useTerritoryNfts({ wallet, address }, userPolygons);

  const firstName = useProfileStore((s) => s.firstName);
  const lastName = useProfileStore((s) => s.lastName);

  // The full name, as the feed and other athletes' profiles show it.
  const displayName = getDisplayName({ firstName, lastName, username });

  const memberSince = createdAt ? formatMonthYear(createdAt) : null;

  const shareProfile = async () => {
    try {
      await Share.share({
        message: walletAddress
          ? `${displayName} on Stryde\n${buildProfileDeepLink(walletAddress)}`
          : `${displayName} on Stryde`,
      });
    } catch (error) {
      logger.error('[Profile] Share failed', error);
      Toast.fail('Could not share your profile', 1);
    }
  };

  const achievementItems = unlockedAchievements.map((a) => {
    const minted = mintedAchievementIds.has(a.id);
    const icon = a.icon as keyof typeof Ionicons.glyphMap;
    return {
      key: a.id,
      minted,
      label: a.title,
      onPress: () => router.push(`/badges/${a.id}`),
      icon: minted ? (
        <AchievementBadge icon={icon} size={40} />
      ) : (
        <Ionicons name={icon} size={22} color={theme.text} />
      ),
    };
  });

  const insets = useSafeAreaInsets();
  // Once the tabs have scrolled to the top they sit under the status bar, so they take its height.
  const headerHeight = useRef(Number.POSITIVE_INFINITY);
  const [pinned, setPinned] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const avatarUpload = useAvatarEdit();
  const avatarUploadStatus = avatarUpload.status;

  return (
    <ThemedView type="background" style={styles.container}>
      <ScrollView
        stickyHeaderIndices={[1]}
        scrollEventThrottle={32}
        onScroll={(e) => setPinned(e.nativeEvent.contentOffset.y >= headerHeight.current - 1)}
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
        {/* The header block sits on a surface: icons, who this is, the pills, the tabs. */}
        <ThemedView
          style={{ backgroundColor: theme.backgroundElement }}
          onLayout={(e) => {
            headerHeight.current = e.nativeEvent.layout.height;
          }}
        >
          <SafeAreaView edges={['top']} style={styles.topBar}>
            <TopBarAction
              icon="trophy-outline"
              label="Leaderboard"
              onPress={() => router.push('/leaderboard')}
            />
            <TopBarAction
              icon="settings-outline"
              label="Settings"
              onPress={() => router.push('/settings')}
            />
          </SafeAreaView>
          <View style={styles.headerBody}>
            <ProfileHero
              displayName={displayName}
              avatar={resolveAvatarUri(avatar, avatarCid)}
              fallbackAvatar={fallbackAvatar}
              ensName={ensLine}
              avatarBusy={!!avatarUploadStatus}
              onAvatarPress={avatarUpload.onPress}
              isVerified={isVerified}
              subline={activityCountLine(activities.length)}
              isEditingName={nameEdit.isEditing}
              editedName={nameEdit.draft}
              setEditedName={nameEdit.setDraft}
              onSaveName={nameEdit.save}
              onStartEditName={nameEdit.start}
              nameShakeStyle={nameEdit.shakeStyle}
            />
            <FollowCounts
              followers={me?.followers ?? 0}
              following={me?.following ?? 0}
              onOpen={(tab) => router.push(`/follow-list?id=${currentUserId}&tab=${tab}`)}
            />
            <AboutLines bio={me?.bio} location={me?.location} />
            <ProfileActions
              onEdit={() => router.push('/profile-edit')}
              onShare={shareProfile}
              onShowQr={walletAddress ? () => setQrOpen(true) : undefined}
            />
            {avatarUploadStatus && (
              <View style={styles.uploadStatus} accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color={theme.brand.primary} />
                <ThemedText type="small">{avatarUploadStatus}</ThemedText>
              </View>
            )}
          </View>
        </ThemedView>
        {/* A direct child of the scroll view so the tabs pin to the top while the body scrolls. */}
        <ThemedView
          style={{ backgroundColor: theme.backgroundElement, paddingTop: pinned ? insets.top : 0 }}
        >
          <UnderlineTabs
            tabs={TABS}
            active={activeTab}
            onChange={(tab) => setActiveTab(tab)}
            icons={TAB_ICONS}
          />
        </ThemedView>

        <View style={styles.bodyPadding}>
          {activeTab === 'Progress' && (
            <>
              <ThemedView style={styles.postHeaderContent}>
                {memberSince ? (
                  <ThemedText type="caption" themeColor="textTertiary">
                    Member since {memberSince}
                  </ThemedText>
                ) : null}

                {streak.current > 0 && (
                  <ThemedView
                    style={[styles.streakHero, { backgroundColor: theme.backgroundElement }]}
                  >
                    <Ionicons name="flame" size={14} color={theme.brand.primary} />
                    <ThemedText type="small" style={[styles.streakText, { color: theme.text }]}>
                      {streak.current} day streak
                    </ThemedText>
                    {streak.longest > streak.current && (
                      <ThemedText type="small" themeColor="textSecondary">
                        · Best {streak.longest}
                      </ThemedText>
                    )}
                  </ThemedView>
                )}

                <WalletPills address={walletAddress} ensName={ensName} strdWei={balances.strd} />
              </ThemedView>

              <ProfileTotals
                items={[
                  {
                    icon: 'resize-outline',
                    value: formatDistance(totalDistance, unitSystem),
                    label: 'Distance',
                  },
                  { icon: 'time-outline', value: formatDuration(totalDuration), label: 'Time' },
                  {
                    icon: 'map-outline',
                    value: formatArea(totalTerritoryArea, unitSystem),
                    label: 'Territory',
                  },
                ]}
              />
            </>
          )}

          {activeTab === 'Progress' && (
            <ThemedView style={styles.tabContent}>
              <WeeklyProgressCard
                stats={weeklyStats}
                goals={weeklyTargets(goals, {
                  distance: weeklyGoalDistance,
                  activities: weeklyGoalActivities,
                  time: weeklyGoalTime,
                })}
                unitSystem={unitSystem}
              />
              <GoalsCard activities={activities} units={unitSystem} />
              <BadgeGrid
                title="Achievements"
                items={achievementItems.slice(0, ACHIEVEMENT_PREVIEW)}
                action={
                  achievementItems.length > ACHIEVEMENT_PREVIEW
                    ? { label: 'See all', onPress: () => setActiveTab('More') }
                    : undefined
                }
              />
              <TrainingLog activities={activities} unitSystem={unitSystem} />
            </ThemedView>
          )}

          {activeTab === 'Activities' && (
            <>
              <Tappable
                onPress={() => router.push('/activities')}
                style={styles.manageRow}
                accessibilityRole="button"
                accessibilityLabel="Search and manage all activities"
              >
                <Ionicons name="search-outline" size={18} color={theme.brand.primary} />
                <ThemedText type="smallBold" themeColor="accentText">
                  Search and manage activities
                </ThemedText>
              </Tappable>
              <ProfilePosts
                author={currentUserId}
                viewerId={currentUserId}
                name={displayName}
                avatarUri={avatar}
                verified={isVerified}
              />
              <ProfileActivitiesTab
                activities={activities}
                sportStats={sportStats}
                unitSystem={unitSystem}
              />
            </>
          )}

          {activeTab === 'More' && (
            <ThemedView style={styles.tabContent}>
              <List>
                <List.Item
                  thumb={<ListIcon name="flag-outline" />}
                  onPress={() => router.push('/goals')}
                  arrow="horizontal"
                >
                  Goals
                </List.Item>
                <List.Item
                  thumb={<ListIcon name="list-outline" />}
                  onPress={() => router.push('/activities')}
                  arrow="horizontal"
                >
                  All activities
                </List.Item>
                <List.Item
                  thumb={<ListIcon name="stats-chart-outline" />}
                  onPress={() => router.push('/athlete-stats')}
                  arrow="horizontal"
                >
                  Statistics
                </List.Item>
                <List.Item
                  thumb={<ListIcon name="calendar-outline" />}
                  onPress={() => router.push('/year-in-sport')}
                  arrow="horizontal"
                >
                  Year in sport
                </List.Item>
                <List.Item
                  thumb={<ListIcon name="cloud-upload-outline" />}
                  onPress={() => router.push('/import-activities')}
                  arrow="horizontal"
                >
                  Import activities
                </List.Item>
                <List.Item
                  thumb={<ListIcon name="ban-outline" />}
                  onPress={() => router.push('/blocked')}
                  arrow="horizontal"
                >
                  Blocked and muted
                </List.Item>
              </List>

              <ProfileStatLists records={records} sportStats={sportStats} unitSystem={unitSystem} />

              <BadgeGrid title="Achievements" items={achievementItems} />

              <BadgeGrid
                title="Territories"
                items={userPolygons.map((polygon) => {
                  const hash = services.territory.computePolygonHash(polygon);
                  return {
                    key: hash,
                    minted: mintedTerritoryIds.has(hash),
                    label: formatArea(territoryService.getPolygonArea(polygon), unitSystem),
                    icon: <Ionicons name="flag-outline" size={22} color={theme.text} />,
                  };
                })}
              />
            </ThemedView>
          )}

          <ThemedView style={{ height: Spacing.six }} />
        </View>
      </ScrollView>
      {walletAddress && (
        <QrSheet
          visible={qrOpen}
          title={displayName}
          link={buildProfileDeepLink(walletAddress)}
          onClose={() => setQrOpen(false)}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: Spacing.three },
  headerBody: { paddingHorizontal: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.three },
  bodyPadding: { padding: Spacing.four, gap: Spacing.three },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },

  uploadStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  postHeaderContent: { gap: Spacing.one },

  streakHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.one,
  },
  streakText: textStyle(TypeScale.footnoteBold),

  tabContent: { gap: Spacing.three },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
