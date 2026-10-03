import type { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type Svg from 'react-native-svg';
import { AchievementNotice } from '@/components/achievement-notice';
import { AvatarStack } from '@/components/avatar-stack';
import { FeedHeader } from '@/components/feed-header';
import { FeedMedia } from '@/components/feed-media';
import { PopupMenu, type PopupMenuItem } from '@/components/popup-menu';
import { ReportSheet } from '@/components/report-sheet';
import { OffscreenShareImage } from '@/components/share-route-image';
import { SocialStrip } from '@/components/social-strip';
import { StatRow } from '@/components/stat-row';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSportLabel, SPORT_ICONS } from '@/constants/activity';
import { DELIVERY_COPY } from '@/constants/copy';
import { Feed } from '@/constants/feed';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useDoubleTap } from '@/hooks/useDoubleTap';
import { useEnsName } from '@/hooks/useEnsName';
import { useHiddenAuthors } from '@/hooks/useHiddenAuthors';
import { retryDeliveries, useDelivery, useDeliveryState } from '@/hooks/useOutbox';
import { useReportSheet } from '@/hooks/useReport';
import { useReportedHidden } from '@/hooks/useReportedHidden';
import { useUserResolver } from '@/hooks/useSocialUser';
import { useBlockStore } from '@/stores/blockStore';
import { type SocialActivity, type SocialUser, useSocialStore } from '@/stores/socialStore';
import type { Achievement } from '@/utils/achievements';
import { activityStats } from '@/utils/activityStats';
import { sameAddress } from '@/utils/address';
import { confirmUnfollow } from '@/utils/confirmUnfollow';
import { formatTimeOfDay, formatWeekdayDay } from '@/utils/dates';
import { feedSubtext } from '@/utils/feedSubtext';
import { getDisplayName, parsePolyline } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { countOf } from '@/utils/plural';
import type { Box } from '@/utils/popupPosition';
import { canReport } from '@/utils/reporting';
import { shareRouteImage } from '@/utils/share';
import { activityKey } from '@/utils/socialFeed';
import { Toast } from '@/utils/toast';
import { visibleComments } from '@/utils/visibleComments';

interface FeedCardProps {
  activity: SocialActivity;
  user: SocialUser;
  onKudos: () => void;
  onComment: () => void;
  onPress: () => void;
  onMapPress?: () => void;
  onUserPress?: () => void;
  /** Badges this activity earned (only known for the viewer's own activities). */
  earned?: readonly Achievement[];
}

export function FeedCard({
  activity,
  user,
  onKudos,
  onComment,
  onPress,
  onMapPress,
  onUserPress,
  earned,
}: FeedCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const unitSystem = useUnitSystem();
  const getUserById = useUserResolver();
  const ensName = useEnsName(user.wallet);
  const me = useCurrentUserId();
  const stats = activityStats(activity, unitSystem).slice(0, 3);
  const when = `${formatWeekdayDay(activity.createdAt)} at ${formatTimeOfDay(activity.createdAt)}`;
  const subtext = feedSubtext({
    when,
    sport: getSportLabel(activity.activityType),
    place: user.location,
    manual: activity.isManual,
  });
  const hasKudoed = activity.kudos.some((id) => id.toLowerCase() === me.toLowerCase());
  const reportedComments = useReportedHidden().comments;
  const hiddenAuthors = useHiddenAuthors();
  // Comments the athlete reported, or by someone they blocked or muted, are gone from the card as well as from the sheet.
  const comments = useMemo(
    () => visibleComments(activity.comments, reportedComments, hiddenAuthors),
    [activity.comments, reportedComments, hiddenAuthors]
  );
  const latestComment = comments.at(-1);
  const [menuAnchor, setMenuAnchor] = useState<Box | null>(null);
  const report = useReportSheet();
  const toggleFollow = useSocialStore((s) => s.toggleFollow);
  const isFollowing = useSocialStore((s) => s.following.has(user.id.toLowerCase()));
  const mute = useBlockStore((s) => s.mute);
  const hideFromHome = useBlockStore((s) => s.hideFromHome);
  const reportTarget = { kind: 'activity', id: activity.id, ownerId: activity.userId } as const;
  const reportable = canReport(reportTarget, me);
  // The outbox files kudos under the store's own key, which for the athlete's own activities is
  // the chain hash while `activity.id` is the local id.
  const storeKey = useSocialStore((s) => activityKey(s.activities, activity.id));
  const kudosKey = `kudos:${storeKey}`;
  const commentKey = `comment:${latestComment?.id ?? ''}`;
  const kudosDelivery = useDelivery(kudosKey);
  const commentDelivery = useDeliveryState(commentKey);
  const notSent = kudosDelivery === 'failed' || commentDelivery === 'failed';
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const cardRef = useRef<View>(null);
  const svgRef = useRef<Svg>(null);
  // The 1080x1920 share image is built only while sharing, not for every card in the feed.
  const [sharing, setSharing] = useState(false);
  const icon = (SPORT_ICONS[activity.activityType] || 'walk') as keyof typeof Ionicons.glyphMap;
  const routeCoordinates = useMemo(() => parsePolyline(activity.polyline), [activity.polyline]);

  const kudosScale = useSharedValue(1);
  const kudosAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: kudosScale.value }],
  }));

  const handleKudos = () => {
    haptics.tap();
    kudosScale.value = withSequence(
      withTiming(1.3, { duration: 120 }),
      withTiming(1, { duration: 150 })
    );
    onKudos();
  };

  // Two quick taps on the media give kudos (never take them back); one opens the activity.
  const onMediaTap = useDoubleTap(onPress, () => {
    if (!hasKudoed) handleKudos();
  });

  const handleSharePress = () => {
    if (sharing) return;
    haptics.tap();
    setSharing(true);
  };

  // Effects run after the commit that mounted the off-screen card, so its ref is attached here.
  useEffect(() => {
    if (!sharing) return;
    shareRouteImage(svgRef, activity.id)
      .catch((error) => {
        logger.warn('[FeedCard] Share failed', error);
        Toast.fail("Couldn't share this activity", 2);
      })
      .finally(() => {
        if (mounted.current) setSharing(false);
      });
  }, [sharing, activity.id]);

  const description = activity.description?.trim();
  const authorName = ensName || user.username;
  const menuItems: PopupMenuItem[] = [
    {
      key: 'follow',
      label: `${isFollowing ? 'Unfollow' : 'Follow'} ${authorName}`,
      icon: isFollowing ? 'person-remove-outline' : 'person-add-outline',
      onPress: () => {
        const run = () => void toggleFollow(user.id);
        if (isFollowing) confirmUnfollow(authorName, run);
        else run();
      },
    },
    {
      key: 'mute',
      label: `Mute ${authorName}`,
      icon: 'volume-mute-outline',
      onPress: () => {
        mute(user.id);
        Toast.success(`Muted ${authorName}`);
      },
    },
    {
      key: 'hide',
      label: 'Hide from Home',
      icon: 'eye-off-outline',
      onPress: () => {
        hideFromHome(activity.id);
        Toast.success('Hidden from Home');
      },
    },
    {
      key: 'report',
      label: 'Report',
      icon: 'flag-outline',
      onPress: () => report.ask(reportTarget),
    },
  ];

  return (
    <View>
      <View ref={cardRef} collapsable={false}>
        <ThemedView style={[styles.entry, { backgroundColor: theme.backgroundElement }]}>
          <FeedHeader
            name={authorName}
            avatarUri={user.avatar}
            verified={user.isVerified}
            subtextIcon={icon}
            subtext={subtext}
            onPress={onUserPress ?? onPress}
            onMore={reportable ? setMenuAnchor : undefined}
          />

          <Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel={activity.name}>
            <ThemedText type="titleSmall" numberOfLines={2} style={styles.title}>
              {activity.name}
            </ThemedText>
          </Tappable>

          {description ? (
            // Only activities that carry their own text show it; another athlete's text lives in IPFS metadata the feed does not fetch.
            <ThemedText type="default" numberOfLines={3} style={styles.description}>
              {description}
            </ThemedText>
          ) : null}

          <StatRow stats={stats} />

          <FeedMedia
            activity={activity}
            icon={icon}
            theme={theme}
            onPress={onMediaTap}
            onMapPress={onMapPress}
          />

          {(activity.kudos.length > 0 || comments.length > 0) && (
            <ThemedView style={styles.socialProof}>
              {activity.kudos.length > 0 && (
                <Tappable
                  onPress={() => router.push(`/kudos?id=${activity.id}`)}
                  hitSlop={8}
                  style={styles.kudosInfo}
                  accessibilityRole="button"
                  accessibilityLabel={`${countOf(activity.kudos.length, 'kudo', 'kudos')}. See who gave them`}
                >
                  <AvatarStack userIds={activity.kudos} max={3} size={22} />
                  <ThemedText type="caption" themeColor="textSecondary">
                    {countOf(activity.kudos.length, 'kudo', 'kudos')}
                  </ThemedText>
                </Tappable>
              )}
              {comments.length > 0 && (
                <Tappable
                  onPress={() => {
                    haptics.tap();
                    onComment();
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${countOf(comments.length, 'comment', 'comments')}. Open comments`}
                >
                  <ThemedText type="caption" themeColor="textSecondary">
                    {countOf(comments.length, 'comment', 'comments')}
                  </ThemedText>
                </Tappable>
              )}
            </ThemedView>
          )}

          {earned && earned.length > 0 && (
            <AchievementNotice
              earned={earned}
              onPress={(badge) => router.push(`/badges/${badge.id}`)}
            />
          )}

          <SocialStrip
            hasKudoed={hasKudoed}
            kudosFailed={kudosDelivery === 'failed'}
            commentCount={comments.length}
            kudosStyle={kudosAnimatedStyle}
            onKudos={handleKudos}
            onSeeKudos={() => router.push(`/kudos?id=${activity.id}`)}
            onComment={() => {
              haptics.tap();
              onComment();
            }}
            onShare={handleSharePress}
          />

          {notSent && (
            <Tappable
              onPress={() => {
                haptics.tap();
                void retryDeliveries([kudosKey, commentKey]);
              }}
              accessibilityRole="button"
              accessibilityLabel="Your change was not sent. Try again"
              style={styles.notSent}
            >
              <ThemedText type="caption" themeColor="dangerText">
                Not sent. Tap to try again
              </ThemedText>
            </Tappable>
          )}

          {latestComment && (
            <Tappable
              onPress={() => {
                haptics.tap();
                onComment();
              }}
              accessibilityRole="button"
              accessibilityLabel="Open comments"
              style={[styles.commentPreview, { backgroundColor: theme.backgroundSunken }]}
            >
              <ThemedText type="small" numberOfLines={2}>
                <ThemedText type="smallBold">
                  {getUserDisplayName(latestComment.userId, getUserById, me)}{' '}
                </ThemedText>
                <ThemedText type="small">{latestComment.text}</ThemedText>
                {commentDelivery && (
                  <ThemedText
                    type="caption"
                    themeColor={commentDelivery === 'failed' ? 'dangerText' : 'textTertiary'}
                  >
                    {commentDelivery === 'failed'
                      ? ' · Not sent'
                      : ` · ${DELIVERY_COPY[commentDelivery]}`}
                  </ThemedText>
                )}
              </ThemedText>
              {comments.length > 1 && (
                <ThemedText type="caption" themeColor="textSecondary" style={styles.viewAll}>
                  View all {comments.length} comments
                </ThemedText>
              )}
            </Tappable>
          )}
        </ThemedView>
      </View>

      <PopupMenu
        anchor={menuAnchor}
        items={menuItems}
        width={248}
        onClose={() => setMenuAnchor(null)}
        accessibilityLabel="Activity options"
      />
      <ReportSheet {...report.props} />

      {/* Off-screen 9:16 stat card, mounted only while sharing; the effect above shares once it is attached. */}
      {sharing && (
        <OffscreenShareImage
          ref={svgRef}
          coordinates={routeCoordinates}
          territory={activity.territory}
          territoryArea={activity.territoryArea}
          distance={activity.distance}
          duration={activity.duration}
          activityType={activity.activityType}
        />
      )}
    </View>
  );
}

function getUserDisplayName(
  userId: string,
  getUserById: (id: string) => SocialUser | undefined,
  currentUserId: string
): string {
  if (sameAddress(userId, currentUserId)) return 'You';
  const user = getUserById(userId);
  return user ? (getDisplayName(user).split(' ')[0] ?? 'Unknown') : 'Unknown';
}

const styles = StyleSheet.create({
  entry: { overflow: 'hidden' },
  title: { paddingHorizontal: Feed.edge, paddingTop: Feed.edge },
  description: { paddingHorizontal: Feed.edge, paddingTop: Spacing.one },
  socialProof: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Feed.edge,
    paddingTop: Spacing.three,
  },
  kudosInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  commentPreview: { paddingHorizontal: Feed.edge, paddingVertical: Spacing.twoHalf },
  viewAll: { marginTop: Spacing.one },
  notSent: { paddingHorizontal: Feed.edge, paddingBottom: Spacing.two },
});
