import type { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type Svg from 'react-native-svg';
import type { PopupMenuItem } from '@/components/popup-menu';
import { getSportLabel, SPORT_ICONS } from '@/constants/activity';
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
import { activityStats, applyHiddenStats, isStatHidden } from '@/utils/activityStats';
import { sameAddress } from '@/utils/address';
import { confirmMute } from '@/utils/confirmMute';
import { confirmUnfollow } from '@/utils/confirmUnfollow';
import { formatWhen } from '@/utils/dates';
import { feedSubtext } from '@/utils/feedSubtext';
import { getDisplayName, parsePolyline } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import type { Box } from '@/utils/popupPosition';
import { canReport } from '@/utils/reporting';
import { shareRouteImage } from '@/utils/share';
import { activityKey } from '@/utils/socialFeed';
import { Toast } from '@/utils/toast';
import { visibleComments } from '@/utils/visibleComments';

interface Options {
  activity: SocialActivity;
  user: SocialUser;
  onKudos: () => void;
  onComment: () => void;
  onPress: () => void;
}

/** Everything a feed card shows or does that is not layout: derived text, comments, delivery state, kudos animation, share and the menu. */
export function useFeedCard({ activity, user, onKudos, onComment, onPress }: Options) {
  const router = useRouter();
  const unitSystem = useUnitSystem();
  const getUserById = useUserResolver();
  const ensName = useEnsName(user.wallet);
  const me = useCurrentUserId();
  const isOwner = sameAddress(activity.userId, me);
  const stats = applyHiddenStats(
    activityStats(activity, unitSystem),
    activity.hiddenStats,
    isOwner
  ).slice(0, 3);
  const when = formatWhen(
    activity.createdAt,
    isStatHidden('start_time', activity.hiddenStats, isOwner)
  );
  const subtext = feedSubtext({
    when,
    sport: getSportLabel(activity.activityType),
    place: user.location,
    manual: activity.isManual,
    imported: activity.isImported,
  });
  const hasKudoed = activity.kudos.some((id) => sameAddress(id, me));
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
      onPress: () =>
        confirmMute(authorName, () => {
          mute(user.id);
          Toast.success(`Muted ${authorName}`);
        }),
    },
    {
      key: 'hide',
      label: 'Hide this activity',
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

  const handleComment = () => {
    haptics.tap();
    onComment();
  };

  return {
    authorName,
    stats,
    subtext,
    icon,
    description: activity.description?.trim(),
    hasKudoed,
    comments,
    latestComment,
    latestCommentAuthor: latestComment
      ? commenterName(latestComment.userId, getUserById, me)
      : undefined,
    kudosFailed: kudosDelivery === 'failed',
    commentDelivery,
    notSent,
    retrySend: () => {
      haptics.tap();
      void retryDeliveries([kudosKey, commentKey]);
    },
    cardRef,
    svgRef,
    sharing,
    routeCoordinates,
    kudosAnimatedStyle,
    handleKudos,
    onMediaTap,
    handleSharePress,
    handleComment,
    openKudos: () => router.push(`/kudos?id=${activity.id}`),
    openBadge: (id: string) => router.push(`/badges/${id}`),
    menu: {
      items: menuItems,
      anchor: menuAnchor,
      open: reportable ? setMenuAnchor : undefined,
      close: () => setMenuAnchor(null),
    },
    report,
  };
}

function commenterName(
  userId: string,
  getUserById: (id: string) => SocialUser | undefined,
  currentUserId: string
): string {
  if (sameAddress(userId, currentUserId)) return 'You';
  const user = getUserById(userId);
  return user ? (getDisplayName(user).split(' ')[0] ?? 'Unknown') : 'Unknown';
}
