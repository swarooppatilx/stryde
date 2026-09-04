import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_ICONS } from '@/constants/activity';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSocialStore } from '@/stores/socialStore';
import { formatDistance } from '@/utils/format';

export default function SearchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const searchUsers = useSocialStore((s) => s.searchUsers);
  const searchActivities = useSocialStore((s) => s.searchActivities);

  const trimmedQuery = query.trim();
  const users = useMemo(
    () => (trimmedQuery.length > 0 ? searchUsers(trimmedQuery) : []),
    [trimmedQuery, searchUsers]
  );
  const activities = useMemo(
    () => (trimmedQuery.length > 0 ? searchActivities(trimmedQuery) : []),
    [trimmedQuery, searchActivities]
  );

  const hasResults = users.length > 0 || activities.length > 0;
  const hasQuery = trimmedQuery.length > 0;

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Search bar */}
        <ThemedView style={styles.searchBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Search people, activities..."
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!hasQuery && (
            <ThemedView style={styles.hint}>
              <Ionicons name="search" size={40} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Search for people or activities
              </ThemedText>
            </ThemedView>
          )}

          {hasQuery && !hasResults && (
            <ThemedView style={styles.hint}>
              <Ionicons name="search-outline" size={40} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                No results for "{trimmedQuery}"
              </ThemedText>
            </ThemedView>
          )}

          {/* People results */}
          {users.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText
                type="eyebrow"
                style={{ color: theme.textSecondary, paddingHorizontal: Spacing.four }}
              >
                People
              </ThemedText>
              {users.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={[styles.userRow, { backgroundColor: theme.backgroundElement }]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/user-profile?id=${user.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={user.name}
                >
                  <View style={[styles.userAvatar, { backgroundColor: theme.brand.primaryTint }]}>
                    <ThemedText type="smallBold" style={{ color: theme.brand.primary }}>
                      {user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </ThemedText>
                  </View>
                  <ThemedView style={styles.userInfo}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {user.name}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      @{user.username} · {user.followers} followers
                    </ThemedText>
                  </ThemedView>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              ))}
            </ThemedView>
          )}

          {/* Activity results */}
          {activities.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText
                type="eyebrow"
                style={{ color: theme.textSecondary, paddingHorizontal: Spacing.four }}
              >
                Activities
              </ThemedText>
              {activities.map((activity) => {
                const icon = (SPORT_ICONS[activity.activityType] ||
                  'walk') as keyof typeof Ionicons.glyphMap;
                return (
                  <TouchableOpacity
                    key={activity.id}
                    style={[styles.activityRow, { backgroundColor: theme.backgroundElement }]}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/activity-summary?id=${activity.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${activity.name}, ${formatDistance(activity.distance)}`}
                  >
                    <View
                      style={[styles.activityIcon, { backgroundColor: theme.brand.primaryTint }]}
                    >
                      <Ionicons name={icon} size={16} color={theme.brand.primary} />
                    </View>
                    <ThemedView style={styles.activityInfo}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {activity.name}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {formatDistance(activity.distance)}
                      </ThemedText>
                    </ThemedView>
                    <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                );
              })}
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.lg,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  scroll: {
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  hint: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
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
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: { flex: 1, gap: 2 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: { flex: 1, gap: 2 },
});
