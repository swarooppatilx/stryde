import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AvatarStack } from '@/components/avatar-stack';
import { RouteThumbnail } from '@/components/route-thumbnail';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_ICONS } from '@/constants/activity';
import { getCurrentUserId } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useEnsName } from '@/hooks/useEnsName';
import type { SocialActivity, SocialUser } from '@/stores/socialStore';
import { useSocialStore } from '@/stores/socialStore';
import { formatDistance, formatDuration, getDisplayName, getInitials } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { shareRouteImage } from '@/utils/share';

interface FeedCardProps {
  activity: SocialActivity;
  user: SocialUser;
  onKudos: () => void;
  onComment: () => void;
  onPress: () => void;
  onMapPress?: () => void;
  onUserPress?: () => void;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatElevation(meters: number): string {
  return `${Math.round(meters)}m`;
}

function UserAvatar({
  name,
  avatarUrl,
  size = 36,
}: {
  name: string;
  avatarUrl?: string;
  size?: number;
}) {
  const theme = useTheme();

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  const initials = getInitials(name);

  return (
    <View
      style={[
        avatarStyles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.brand.primaryTint,
        },
      ]}
    >
      <ThemedText type="smallBold" style={{ color: theme.brand.primary, fontSize: size * 0.38 }}>
        {initials}
      </ThemedText>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

function MediaSection({
  activity,
  icon,
  theme,
  onPress,
  onMapPress,
}: {
  activity: SocialActivity;
  icon: keyof typeof Ionicons.glyphMap;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
  onMapPress?: () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const images = activity.images ?? (activity.image ? [activity.image] : []);
  const hasMap = !!activity.polyline;
  const totalItems = images.length + (hasMap ? 1 : 0);

  if (totalItems === 0) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== containerWidth) setContainerWidth(w);
  };

  const onScroll = (e: {
    nativeEvent: { contentOffset: { x: number }; layoutMeasurement: { width: number } };
  }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
    setActiveIndex(idx);
  };

  const carouselHeight = 200;

  // Single image only — no carousel
  if (totalItems === 1 && images.length === 1) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.thumbnailContainer}>
        <Image
          source={{ uri: images[0] }}
          style={[styles.activityImage, { backgroundColor: theme.background }]}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }

  // Single map only — no carousel
  if (totalItems === 1 && hasMap) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onMapPress ?? onPress}
        style={styles.thumbnailContainer}
      >
        <RouteThumbnail
          polyline={activity.polyline}
          territory={activity.territory}
          height={carouselHeight}
          fallback={
            <View style={[styles.thumbnailFallback, { backgroundColor: theme.background }]}>
              <Ionicons name={icon} size={32} color={theme.textSecondary} />
            </View>
          }
        />
      </TouchableOpacity>
    );
  }

  // Carousel: images + optional map
  const itemWidth = containerWidth || Dimensions.get('window').width;

  return (
    <View onLayout={onLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.carousel}
      >
        {images.map((uri, i) => (
          <TouchableOpacity
            key={`img-${i}`}
            activeOpacity={0.7}
            onPress={onPress}
            style={[styles.carouselItem, { width: itemWidth, height: carouselHeight }]}
          >
            <Image
              source={{ uri }}
              style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
        {hasMap && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onMapPress ?? onPress}
            style={[styles.carouselItem, { width: itemWidth, height: carouselHeight }]}
          >
            <RouteThumbnail
              polyline={activity.polyline}
              territory={activity.territory}
              height={carouselHeight}
              fallback={
                <View
                  style={[
                    styles.thumbnailFallback,
                    { backgroundColor: theme.background, height: carouselHeight },
                  ]}
                >
                  <Ionicons name={icon} size={32} color={theme.textSecondary} />
                </View>
              }
            />
          </TouchableOpacity>
        )}
      </ScrollView>
      {/* Pagination dots */}
      {totalItems > 1 && (
        <View style={styles.pagination}>
          {Array.from({ length: totalItems }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === activeIndex ? theme.brand.primary : theme.border },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function FeedCard({
  activity,
  user,
  onKudos,
  onComment,
  onPress,
  onMapPress,
  onUserPress,
}: FeedCardProps) {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const getUserById = useSocialStore((s) => s.getUserById);
  const ensName = useEnsName(user.wallet);
  const hasKudoed = activity.kudos.includes(getCurrentUserId());
  const cardRef = useRef<View>(null);
  const icon = (SPORT_ICONS[activity.activityType] || 'walk') as keyof typeof Ionicons.glyphMap;

  // Kudos animation
  const kudosScale = useSharedValue(1);
  const kudosAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: kudosScale.value }],
  }));

  const handleKudos = () => {
    haptics.impactMedium();
    kudosScale.value = withSequence(
      withTiming(1.3, { duration: 120 }),
      withTiming(1, { duration: 150 })
    );
    onKudos();
  };

  const handleShare = () => {
    haptics.tap();
    shareRouteImage(cardRef);
  };

  return (
    <View ref={cardRef} collapsable={false}>
      <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        {/* Header: user info */}
        <TouchableOpacity
          style={styles.header}
          activeOpacity={0.7}
          onPress={onUserPress ?? onPress}
          accessibilityRole="button"
          accessibilityLabel={`${user.username}'s activity`}
        >
          <UserAvatar name={user.username} avatarUrl={user.avatar} />
          <ThemedView style={styles.headerText}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {ensName || user.username}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatRelativeTime(activity.createdAt)} ·{' '}
              {activity.activityType.charAt(0).toUpperCase() + activity.activityType.slice(1)}
              {user.location ? ` · ${user.location}` : ''}
            </ThemedText>
          </ThemedView>
        </TouchableOpacity>

        {/* Activity title */}
        <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
          <ThemedText type="sectionTitle" numberOfLines={1} style={styles.title}>
            {activity.name}
          </ThemedText>
        </TouchableOpacity>

        {/* Stats row - hide for image-only posts */}
        {(activity.distance > 0 || activity.duration > 0) && (
          <ThemedView style={styles.statsRow}>
            {activity.distance > 0 && (
              <ThemedView style={styles.stat}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Distance
                </ThemedText>
                <ThemedText type="smallBold">
                  {formatDistance(activity.distance, unitSystem)}
                </ThemedText>
              </ThemedView>
            )}
            {activity.duration > 0 && (
              <ThemedView style={styles.stat}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Time
                </ThemedText>
                <ThemedText type="smallBold">{formatDuration(activity.duration)}</ThemedText>
              </ThemedView>
            )}
            {activity.elevationGain != null && activity.elevationGain > 0 && (
              <ThemedView style={styles.stat}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Elevation
                </ThemedText>
                <ThemedText type="smallBold">{formatElevation(activity.elevationGain)}</ThemedText>
              </ThemedView>
            )}
          </ThemedView>
        )}

        {/* Media: image, route, or carousel */}
        <MediaSection
          activity={activity}
          icon={icon}
          theme={theme}
          onPress={onPress}
          onMapPress={onMapPress}
        />

        {/* Territory badge */}
        {activity.territoryArea > 0 && (
          <ThemedView
            style={[
              styles.territoryBadge,
              { backgroundColor: theme.background, borderColor: theme.border },
            ]}
          >
            <Ionicons name="shield-checkmark-outline" size={14} color={theme.brand.primary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Territory captured
            </ThemedText>
          </ThemedView>
        )}

        {/* Kudos + comments count row */}
        <ThemedView style={styles.socialProof}>
          {activity.kudos.length > 0 && (
            <ThemedView style={styles.kudosInfo}>
              <AvatarStack userIds={activity.kudos} max={3} size={22} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {activity.kudos.length} {activity.kudos.length === 1 ? 'kudo' : 'kudos'}
              </ThemedText>
            </ThemedView>
          )}
          {activity.comments.length > 0 && (
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {activity.comments.length} {activity.comments.length === 1 ? 'comment' : 'comments'}
            </ThemedText>
          )}
        </ThemedView>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* Three-column action bar */}
        <ThemedView style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleKudos}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={hasKudoed ? 'Remove kudos' : 'Give kudos'}
            accessibilityState={{ selected: hasKudoed }}
          >
            <Animated.View style={kudosAnimatedStyle}>
              <Ionicons
                name={hasKudoed ? 'thumbs-up' : 'thumbs-up-outline'}
                size={20}
                color={hasKudoed ? theme.brand.primary : theme.textSecondary}
              />
            </Animated.View>
            <ThemedText
              type="small"
              style={{ color: hasKudoed ? theme.brand.primary : theme.textSecondary }}
            >
              Kudos
            </ThemedText>
          </TouchableOpacity>

          <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              haptics.tap();
              onComment();
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${activity.comments.length} comments`}
          >
            <Ionicons name="chatbubble-outline" size={20} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Comment
            </ThemedText>
          </TouchableOpacity>

          <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleShare}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Share activity"
          >
            <Ionicons name="arrow-redo-outline" size={20} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Share
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Latest comment preview */}
        {activity.comments.length > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.commentPreview}>
              <ThemedText type="small" numberOfLines={2}>
                <ThemedText type="smallBold">
                  {getUserDisplayName(
                    activity.comments[activity.comments.length - 1].userId,
                    getUserById
                  )}{' '}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {activity.comments[activity.comments.length - 1].text}
                </ThemedText>
              </ThemedText>
            </ThemedView>
          </>
        )}
      </ThemedView>
    </View>
  );
}

function getUserDisplayName(
  userId: string,
  getUserById: (id: string) => SocialUser | undefined
): string {
  if (userId === getCurrentUserId()) return 'You';
  const user = getUserById(userId);
  return user ? getDisplayName(user).split(' ')[0] : 'Unknown';
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    paddingBottom: 0,
  },
  headerText: { flex: 1, gap: 2 },
  title: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  stat: { alignItems: 'center', gap: 2 },
  thumbnailContainer: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  activityImage: {
    width: '100%',
    height: 200,
  },
  thumbnailFallback: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carousel: {
    marginTop: Spacing.two,
  },
  carouselItem: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  territoryBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one + Spacing.half,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.full,
  },
  socialProof: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  kudosInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  commentPreview: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: Spacing.one,
  },
});
