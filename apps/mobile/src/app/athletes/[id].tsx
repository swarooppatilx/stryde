import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { FollowCounts } from '@/components/follow-counts';
import { DetailFallback, ListMessage } from '@/components/list-message';
import { NumberFlow } from '@/components/number-flow';
import {
  AnimatedScrollView,
  HeaderComponentWrapper,
  HeaderNavBar,
} from '@/components/parallax-header';
import { ProfilePosts } from '@/components/profile-posts';
import { ProfileTotals } from '@/components/profile-summary';
import { ReportSheet } from '@/components/report-sheet';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TrainingLog } from '@/components/training-log';
import { SPORT_ICONS } from '@/constants/activity';
import { Palette } from '@/constants/palette';
import { BorderRadius, Brand, Spacing, tint } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useAthleteComposite } from '@/hooks/useAthleteComposite';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useEnsName } from '@/hooks/useEnsName';
import { useGoBack } from '@/hooks/useGoBack';
import { useReportSheet } from '@/hooks/useReport';
import { useSocialUser } from '@/hooks/useSocialUser';
import { useBlockStore } from '@/stores/blockStore';
import { useSocialStore, visibleActivities } from '@/stores/socialStore';
import { sameAddress } from '@/utils/address';
import { confirmBlock } from '@/utils/confirmBlock';
import { confirmMute } from '@/utils/confirmMute';
import { confirmUnfollow } from '@/utils/confirmUnfollow';
import { buildProfileDeepLink } from '@/utils/deepLink';
import { followButtonLabel, followsViewer } from '@/utils/followRelation';
import {
  formatArea,
  formatDistance,
  formatDuration,
  getDisplayName,
  getInitials,
} from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { canReport } from '@/utils/reporting';
import { shareMessage } from '@/utils/shareMessage';
import { Toast } from '@/utils/toast';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const count = (value: number) => (
    <NumberFlow value={value} fontSize={16} fontWeight="700" color={theme.text} />
  );

  const toggleFollow = useSocialStore((s) => s.toggleFollow);
  const loadFollowStats = useSocialStore((s) => s.loadFollowStats);
  const loadAbout = useSocialStore((s) => s.loadAbout);
  const following = useSocialStore((s) => s.following);

  const user = useSocialUser(id);
  // An athlete opened by link may not be in the cached list yet: look them up before saying "not found".
  const fetchUsers = useSocialStore((s) => s.fetchUsers);
  const [lookup, setLookup] = useState<'loading' | 'done' | 'failed'>(user ? 'done' : 'loading');
  const findAthlete = useCallback(async () => {
    setLookup('loading');
    setLookup((await fetchUsers()) ? 'done' : 'failed');
  }, [fetchUsers]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: look up once per athlete opened
  useEffect(() => {
    if (!user) void findAthlete();
  }, [id]);
  useEffect(() => {
    if (!id) return;
    void loadFollowStats(id as `0x${string}`);
    void loadAbout([id]);
  }, [id, loadFollowStats, loadAbout]);
  const allActivities = useSocialStore((s) => s.activities);
  const me = useCurrentUserId();
  const activities = useMemo(
    () =>
      id
        ? visibleActivities(
            Object.values(allActivities).filter((a) => sameAddress(a.userId, id)),
            me,
            following
          )
        : [],
    [id, allActivities, me, following]
  );
  const isFollowing = user ? following.has(user.id.toLowerCase()) : false;
  const followerEntries = useSocialStore((s) => s.followerEntries);
  const followLabel = followButtonLabel({
    isFollowing,
    followsViewer: user ? followsViewer(user.id, followerEntries) : false,
  });
  // Your own profile is not something you can follow — and the store would otherwise
  // sign a self-follow edge on chain for anyone who taps the button there.
  const isSelf = sameAddress(me, id);

  const totalDistance = useMemo(
    () => activities.reduce((sum, a) => sum + a.distance, 0),
    [activities]
  );

  const ensName = useEnsName(user?.wallet);

  // Territory area, achievements and the verified tick come from the subgraph, best-effort.
  const { stats, refreshing, refresh: onRefresh } = useAthleteComposite(user?.wallet);
  const { territoryArea, achievementCount, isVerified } = stats;

  const [menuOpen, setMenuOpen] = useState(false);
  const report = useReportSheet();
  const isBlocked = useBlockStore((s) => !!id && s.blocked.includes(id.toLowerCase()));
  const isMuted = useBlockStore((s) => !!id && s.muted.includes(id.toLowerCase()));

  if (!user) {
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            style={styles.fallbackBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <DetailFallback
            what="athlete"
            loading={lookup === 'loading'}
            error={lookup === 'failed' ? 'load' : null}
            onRetry={() => void findAthlete()}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (isBlocked) {
    const blockedName = getDisplayName(user);
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            style={styles.fallbackBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ListMessage
            fill
            icon="ban-outline"
            text={`You blocked ${blockedName}.`}
            // `unblock` is destructured below this early return, so it is still
            // in its temporal dead zone here; read it from the store at press time.
            action={{ label: 'Unblock', onPress: () => useBlockStore.getState().unblock(user.id) }}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);
  const renderedName = ensName || displayName;

  const { block, mute, unmute } = useBlockStore.getState();

  const shareAthlete = () =>
    shareMessage(
      `${displayName} on Stryde\n${buildProfileDeepLink(user.id)}`,
      'Could not share this profile'
    );
  const blockAthlete = () =>
    confirmBlock(displayName, () => {
      if (isFollowing) void toggleFollow(user.id);
      block(user.id);
      Toast.success(`Blocked ${displayName}`);
    });
  const menuActions: SheetAction[] = [
    { label: 'Share profile', icon: 'share-outline', onPress: () => void shareAthlete() },
    isMuted
      ? { label: 'Unmute', icon: 'volume-high-outline', onPress: () => unmute(user.id) }
      : {
          label: 'Mute',
          icon: 'volume-mute-outline',
          onPress: () =>
            confirmMute(displayName, () => {
              mute(user.id);
              Toast.success(`Muted ${displayName}`);
            }),
        },
    { label: 'Block', icon: 'ban-outline', onPress: blockAthlete, destructive: true },
  ];
  const reportTarget = { kind: 'user', id: user.id, ownerId: user.id } as const;
  if (canReport(reportTarget, me)) {
    menuActions.push({
      label: 'Report',
      icon: 'flag-outline',
      onPress: () => report.ask(reportTarget),
      destructive: true,
    });
  }

  const handleFollow = () => {
    const run = () => {
      haptics.impactMedium();
      void toggleFollow(user.id);
    };
    if (isFollowing) confirmUnfollow(displayName, run);
    else run();
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <AnimatedScrollView
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
        headerMaxHeight={240}
        topBarHeight={90}
        renderHeaderComponent={() => (
          <HeaderComponentWrapper>
            <LinearGradient
              colors={[Brand.primary, Brand.primaryPressed]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.parallaxAvatarWrap}>
              {user.avatar ? (
                <Image
                  source={{ uri: user.avatar }}
                  style={styles.avatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: tint(Palette.white, 0.2) }]}>
                  <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
                </View>
              )}
            </View>
          </HeaderComponentWrapper>
        )}
        renderOveralComponent={() => (
          <View style={styles.parallaxOverlay}>
            <View style={styles.nameRow}>
              <ThemedText style={[styles.name, { color: Brand.white }]}>{renderedName}</ThemedText>
              {isVerified && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={Brand.white}
                  accessibilityLabel="Verified with World ID"
                />
              )}
            </View>
            <ThemedText type="small" style={{ color: tint(Palette.white, 0.85) }}>
              @{user.username}
            </ThemedText>
          </View>
        )}
        renderTopNavBarComponent={() => (
          <HeaderNavBar
            headerHeight={90}
            tint={theme.isDark ? 'dark' : 'light'}
            intensity={80}
            backgroundColor={theme.background}
          >
            <Tappable
              onPress={goBack}
              activeOpacity={0.7}
              style={[styles.backBtn, { backgroundColor: theme.backgroundElement }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </Tappable>
            <ThemedText type="smallBold" numberOfLines={1}>
              {renderedName}
            </ThemedText>
            {isSelf ? (
              <View style={styles.navSpacer} />
            ) : (
              <Tappable
                onPress={() => setMenuOpen(true)}
                activeOpacity={0.7}
                style={[styles.backBtn, { backgroundColor: theme.backgroundElement }]}
                accessibilityRole="button"
                accessibilityLabel="More options"
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={theme.text} />
              </Tappable>
            )}
          </HeaderNavBar>
        )}
      >
        <View style={styles.bodyPadding}>
          <ThemedView style={styles.profileSection}>
            {user.bio && (
              <ThemedText type="small" style={[styles.bio, { color: theme.textSecondary }]}>
                {user.bio}
              </ThemedText>
            )}

            <FollowCounts
              followers={user.followers}
              following={user.following}
              onOpen={(tab) => router.push(`/follow-list?id=${user.id}&tab=${tab}`)}
            />

            {user.location && (
              <ThemedView style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                <ThemedText type="caption" themeColor="textSecondary">
                  {user.location}
                </ThemedText>
              </ThemedView>
            )}

            <ProfileTotals
              compact
              items={[
                { value: count(activities.length), label: 'Activities' },
                { value: formatDistance(totalDistance, unitSystem), label: 'Distance' },
                ...(territoryArea !== null && territoryArea > 0
                  ? [{ value: formatArea(territoryArea, unitSystem), label: 'Territory' }]
                  : []),
                ...(achievementCount !== null && achievementCount > 0
                  ? [{ value: count(achievementCount), label: 'Achievements' }]
                  : []),
              ]}
            />

            {/* Follow button — absent on your own profile */}
            {!isSelf && (
              <Tappable
                style={[
                  styles.followBtn,
                  {
                    backgroundColor: isFollowing ? theme.backgroundElement : theme.brand.primary,
                    borderColor: isFollowing ? theme.border : theme.brand.primary,
                  },
                ]}
                onPress={handleFollow}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  isFollowing ? `Unfollow ${renderedName}` : `${followLabel} ${renderedName}`
                }
                accessibilityState={{ selected: isFollowing }}
              >
                <Ionicons
                  name={isFollowing ? 'checkmark' : 'person-add-outline'}
                  size={16}
                  color={isFollowing ? theme.text : Brand.white}
                />
                <ThemedText
                  type="smallBold"
                  style={{ color: isFollowing ? theme.text : Brand.white }}
                >
                  {followLabel}
                </ThemedText>
              </Tappable>
            )}
          </ThemedView>

          <ProfilePosts
            author={user.id}
            viewerId={me}
            name={ensName || user.username}
            avatarUri={user.avatar}
            verified={isVerified || user.isVerified}
          />

          <Tappable
            style={[styles.statsRow, { backgroundColor: theme.backgroundElement }]}
            onPress={() => router.push(`/athlete-stats?id=${user.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${displayName}'s statistics`}
          >
            <Ionicons name="stats-chart-outline" size={20} color={theme.text} />
            <ThemedText type="smallBold" style={styles.statsLabel}>
              Statistics
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </Tappable>

          {activities.length > 0 && (
            <View style={styles.trainingLog}>
              <TrainingLog activities={activities} unitSystem={unitSystem} />
            </View>
          )}

          <ThemedView style={styles.section}>
            <ThemedText type="sectionTitle">Recent Activities</ThemedText>

            {activities.length === 0 ? (
              <ThemedView style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="walk-outline" size={32} color={theme.textSecondary} />
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, textAlign: 'center' }}
                >
                  No activities yet
                </ThemedText>
              </ThemedView>
            ) : (
              activities.map((activity) => {
                const icon = (SPORT_ICONS[activity.activityType] ||
                  'walk') as keyof typeof Ionicons.glyphMap;
                return (
                  <Tappable
                    key={activity.id}
                    style={[styles.activityCard, { backgroundColor: theme.backgroundElement }]}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/activities/${activity.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${activity.name}, ${formatDistance(activity.distance, unitSystem)}`}
                  >
                    <View
                      style={[styles.activityIcon, { backgroundColor: theme.brand.primaryTint }]}
                    >
                      <Ionicons name={icon} size={18} color={theme.brand.primary} />
                    </View>
                    <ThemedView style={styles.activityInfo}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {activity.name}
                      </ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {formatDistance(activity.distance, unitSystem)} ·{' '}
                        {formatDuration(activity.duration)}
                      </ThemedText>
                    </ThemedView>
                    <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                  </Tappable>
                );
              })
            )}
          </ThemedView>
        </View>
      </AnimatedScrollView>
      <ActionSheet
        visible={menuOpen}
        title={renderedName}
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />
      <ReportSheet {...report.props} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  trainingLog: { marginHorizontal: Spacing.four },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Spacing.four,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  statsLabel: { flex: 1 },
  fallbackBack: { padding: Spacing.three, alignSelf: 'flex-start' },
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { paddingBottom: Spacing.three },
  bodyPadding: { gap: Spacing.three },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navSpacer: { width: 36 },

  parallaxAvatarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parallaxOverlay: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingBottom: Spacing.three,
  },

  profileSection: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: Brand.white,
    ...textStyle(TypeScale.title),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    marginTop: Spacing.one,
  },
  name: {
    ...textStyle(TypeScale.headline),
  },
  bio: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.one,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },

  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    width: '100%',
    marginTop: Spacing.two,
  },

  section: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  emptyCard: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: BorderRadius.lg,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: { flex: 1, gap: Spacing.half },
});
