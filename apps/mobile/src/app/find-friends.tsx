import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyInboxState } from '@/components/empty-inbox-v1';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserAvatar } from '@/components/user-avatar';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type SocialUser, useSocialStore } from '@/stores/socialStore';
import { getDisplayName } from '@/utils/format';
import { haptics } from '@/utils/haptics';

function FollowPill({ isFollowing, onPress }: { isFollowing: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.followPill,
        {
          backgroundColor: isFollowing ? theme.backgroundElement : theme.brand.primary,
          borderColor: isFollowing ? theme.border : theme.brand.primary,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
      accessibilityState={{ selected: isFollowing }}
    >
      <Ionicons
        name={isFollowing ? 'person-remove-outline' : 'person-add-outline'}
        size={14}
        color={isFollowing ? theme.text : Brand.white}
      />
      <ThemedText type="smallBold" style={{ color: isFollowing ? theme.text : Brand.white }}>
        {isFollowing ? 'Following' : 'Follow'}
      </ThemedText>
    </TouchableOpacity>
  );
}

function UserRow({
  user,
  isFollowing,
  onFollow,
}: {
  user: SocialUser;
  isFollowing: boolean;
  onFollow: () => void;
}) {
  const router = useRouter();
  const theme = useTheme();
  const displayName = getDisplayName(user);
  return (
    <TouchableOpacity
      style={[styles.userRow, { backgroundColor: theme.backgroundElement }]}
      activeOpacity={0.7}
      onPress={() => router.push(`/user-profile?id=${user.id}`)}
      accessibilityRole="button"
      accessibilityLabel={displayName}
    >
      <UserAvatar uri={user.avatar} name={displayName} size={40} />
      <ThemedView style={styles.userInfo}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {displayName}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          @{user.username} · {user.followers} followers
        </ThemedText>
      </ThemedView>
      <FollowPill isFollowing={isFollowing} onPress={onFollow} />
    </TouchableOpacity>
  );
}

export default function FindFriendsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const users = useSocialStore((s) => s.users);
  const following = useSocialStore((s) => s.following);
  const getSuggestions = useSocialStore((s) => s.getSuggestions);
  const searchUsers = useSocialStore((s) => s.searchUsers);
  const toggleFollow = useSocialStore((s) => s.toggleFollow);
  const fetchUsers = useSocialStore((s) => s.fetchUsers);
  const fetchActivities = useSocialStore((s) => s.fetchActivities);

  useFocusEffect(
    useCallback(() => {
      void fetchUsers();
      void fetchActivities();
    }, [fetchUsers, fetchActivities])
  );

  // getSuggestions() reads users/activities/following from the store's own
  // get() internally, so users/following are only recompute triggers here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: users/following re-trigger getSuggestions(), not read in this callback
  const suggestions = useMemo(() => getSuggestions(), [getSuggestions, users, following]);

  const trimmedQuery = query.trim();
  const searchResults = useMemo(
    () => (trimmedQuery.length > 0 ? searchUsers(trimmedQuery) : []),
    [trimmedQuery, searchUsers]
  );

  const handleToggleFollow = useCallback(
    (userId: string) => {
      haptics.impactMedium();
      toggleFollow(userId);
    },
    [toggleFollow]
  );

  const hasRegisteredUsers = Object.keys(users).length > 0;
  const allSuggestedFollowed = hasRegisteredUsers && suggestions.length === 0;

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="subtitle" numberOfLines={1} style={styles.title}>
            Find Friends
          </ThemedText>
          <ThemedView style={styles.headerSpacer} />
        </ThemedView>

        {/* Search */}
        <ThemedView style={styles.searchWrap}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Find by username..."
            style={styles.inputWrapper}
          />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {trimmedQuery.length === 0 ? (
            <>
              <ThemedText
                type="eyebrow"
                style={{ color: theme.textSecondary, paddingHorizontal: Spacing.four }}
              >
                Suggestions for you
              </ThemedText>

              {suggestions.length === 0 ? (
                <EmptyInboxState
                  title={allSuggestedFollowed ? "You're all caught up" : 'No suggestions yet'}
                  description={
                    allSuggestedFollowed
                      ? 'You follow everyone in the community.'
                      : 'Suggestions appear once other people join and post activities.'
                  }
                  animated={false}
                  colors={{
                    screen: 'transparent',
                    title: theme.text,
                    description: theme.textSecondary,
                    skeleton: theme.backgroundElement,
                    skeletonStrong: theme.backgroundSelected,
                  }}
                  style={styles.emptyCard}
                />
              ) : (
                <ThemedView style={styles.section}>
                  {suggestions.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      isFollowing={following.has(user.id.toLowerCase())}
                      onFollow={() => handleToggleFollow(user.id)}
                    />
                  ))}
                </ThemedView>
              )}
            </>
          ) : searchResults.length === 0 ? (
            <ThemedView style={styles.hint}>
              <Ionicons name="search-outline" size={40} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                No users found for "{trimmedQuery}"
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView style={styles.section}>
              {searchResults.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isFollowing={following.has(user.id.toLowerCase())}
                  onFollow={() => handleToggleFollow(user.id)}
                />
              ))}
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: { flex: 1 },
  headerSpacer: { width: 22 },
  searchWrap: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  inputWrapper: {
    borderRadius: BorderRadius.lg,
    borderWidth: 0,
  },
  scroll: {
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  userInfo: { flex: 1, gap: 2 },
  followPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  hint: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.five,
  },
  emptyCard: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
});
