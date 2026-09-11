import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NumberFlow } from '@/components/number-flow';
import {
  AnimatedScrollView,
  HeaderComponentWrapper,
  HeaderNavBar,
} from '@/components/parallax-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_ICONS } from '@/constants/activity';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useEnsName } from '@/hooks/useEnsName';
import { useSocialStore } from '@/stores/socialStore';
import { formatDistance, formatDuration, getDisplayName, getInitials } from '@/utils/format';
import { haptics } from '@/utils/haptics';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  const getUserById = useSocialStore((s) => s.getUserById);
  const getUserActivities = useSocialStore((s) => s.getUserActivities);
  const toggleFollow = useSocialStore((s) => s.toggleFollow);
  const following = useSocialStore((s) => s.following);

  const user = getUserById(id ?? '');
  // biome-ignore lint/correctness/useExhaustiveDependencies: following is a recompute trigger for getUserActivities()'s privacy filter, not read in this callback
  const activities = useMemo(
    () => (id ? getUserActivities(id) : []),
    [id, getUserActivities, following]
  );
  const isFollowing = user ? following.has(user.id.toLowerCase()) : false;

  const totalDistance = useMemo(
    () => activities.reduce((sum, a) => sum + a.distance, 0),
    [activities]
  );

  const ensName = useEnsName(user?.wallet);

  if (!user) {
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.centered}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              User not found
            </ThemedText>
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);
  const renderedName = ensName || displayName;

  const handleFollow = () => {
    haptics.impactMedium();
    toggleFollow(user.id);
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <AnimatedScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
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
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
                </View>
              )}
            </View>
          </HeaderComponentWrapper>
        )}
        renderOveralComponent={() => (
          <View style={styles.parallaxOverlay}>
            <ThemedText style={[styles.name, { color: Brand.white }]}>{renderedName}</ThemedText>
            <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.85)' }}>
              @{user.username}
            </ThemedText>
          </View>
        )}
        renderTopNavBarComponent={() => (
          <HeaderNavBar headerHeight={90} tint={theme.isDark ? 'dark' : 'light'} intensity={80}>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              style={[styles.backBtn, { backgroundColor: theme.backgroundElement }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </TouchableOpacity>
            <ThemedText type="smallBold" numberOfLines={1}>
              {renderedName}
            </ThemedText>
            <View style={styles.navSpacer} />
          </HeaderNavBar>
        )}
      >
        <View style={styles.bodyPadding}>
          {/* Profile */}
          <ThemedView style={styles.profileSection}>
            {user.bio && (
              <ThemedText type="small" style={[styles.bio, { color: theme.textSecondary }]}>
                {user.bio}
              </ThemedText>
            )}

            {user.location && (
              <ThemedView style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {user.location}
                </ThemedText>
              </ThemedView>
            )}

            {/* Stats */}
            <ThemedView style={[styles.statsRow, { backgroundColor: theme.backgroundElement }]}>
              <ThemedView style={styles.stat}>
                <NumberFlow
                  value={activities.length}
                  fontSize={16}
                  fontWeight="700"
                  color={theme.text}
                />
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Activities
                </ThemedText>
              </ThemedView>
              <ThemedView style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <ThemedView style={styles.stat}>
                <ThemedText style={[styles.statVal, { color: theme.text }]}>
                  {formatDistance(totalDistance)}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Distance
                </ThemedText>
              </ThemedView>
              <ThemedView style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <ThemedView style={styles.stat}>
                <NumberFlow
                  value={user.followers}
                  fontSize={16}
                  fontWeight="700"
                  color={theme.text}
                />
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Followers
                </ThemedText>
              </ThemedView>
            </ThemedView>

            {/* Follow button */}
            <TouchableOpacity
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
                isFollowing ? `Unfollow ${renderedName}` : `Follow ${renderedName}`
              }
              accessibilityState={{ selected: isFollowing }}
            >
              <Ionicons
                name={isFollowing ? 'person-remove-outline' : 'person-add-outline'}
                size={16}
                color={isFollowing ? theme.text : Brand.white}
              />
              <ThemedText
                type="smallBold"
                style={{ color: isFollowing ? theme.text : Brand.white }}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>

          {/* Recent Activities */}
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
                  <TouchableOpacity
                    key={activity.id}
                    style={[styles.activityCard, { backgroundColor: theme.backgroundElement }]}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/activity-summary?id=${activity.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${activity.name}, ${formatDistance(activity.distance)}`}
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
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {formatDistance(activity.distance)} · {formatDuration(activity.duration)}
                      </ThemedText>
                    </ThemedView>
                    <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                );
              })
            )}
          </ThemedView>
        </View>
      </AnimatedScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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

  /* Parallax Header */
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

  profileSection: { alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.four },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: Spacing.one,
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

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.three,
    width: '100%',
    marginTop: Spacing.two,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 16, fontWeight: '700' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32 },

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
  activityInfo: { flex: 1, gap: 2 },
});
