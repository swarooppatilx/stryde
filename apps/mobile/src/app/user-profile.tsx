import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_ICONS } from '@/constants/activity';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const activities = useMemo(() => (id ? getUserActivities(id) : []), [id, getUserActivities]);
  const isFollowing = user ? following.includes(user.id) : false;

  const totalDistance = useMemo(
    () => activities.reduce((sum, a) => sum + a.distance, 0),
    [activities]
  );

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

  const handleFollow = () => {
    haptics.impactMedium();
    toggleFollow(user.id);
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <ThemedView style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              style={[styles.backBtn, { backgroundColor: theme.backgroundElement }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </TouchableOpacity>
          </ThemedView>

          {/* Profile */}
          <ThemedView style={styles.profileSection}>
            <View style={[styles.avatar, { backgroundColor: theme.brand.primary }]}>
              <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
            </View>

            <ThemedText style={styles.name}>{displayName}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              @{user.username}
            </ThemedText>

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
                <ThemedText style={[styles.statVal, { color: theme.text }]}>
                  {activities.length}
                </ThemedText>
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
                <ThemedText style={[styles.statVal, { color: theme.text }]}>
                  {user.followers}
                </ThemedText>
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
              accessibilityLabel={isFollowing ? `Unfollow ${displayName}` : `Follow ${displayName}`}
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
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { gap: Spacing.three },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
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
  statVal: { fontSize: 18, fontWeight: '700' },
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
