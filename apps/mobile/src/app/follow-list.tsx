import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListMessage } from '@/components/list-message';
import { PersonRow } from '@/components/search-rows';
import { SkeletonRows } from '@/components/skeleton-rows';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UnderlineTabs } from '@/components/underline-tabs';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useGoBack } from '@/hooks/useGoBack';
import { useHiddenAuthors } from '@/hooks/useHiddenAuthors';
import { useUserResolver } from '@/hooks/useSocialUser';
import { followListUsers } from '@/utils/followListUsers';
import { logger } from '@/utils/logger';
import type { SocialUser } from '@/utils/socialSelectors';
import { withoutHidden } from '@/utils/withoutHidden';

const TABS = ['Followers', 'Following'] as const;
type Tab = (typeof TABS)[number];

type Loaded = { state: 'loading' } | { state: 'error' } | { state: 'ready'; addresses: string[] };

const SKELETON_ROWS = 6;

/** Who follows an athlete, and who they follow. Opened from the counts on a profile. */
function emptyMessage(showingFollowers: boolean, isOwn: boolean): string {
  if (showingFollowers) {
    return isOwn
      ? 'You currently have no followers.'
      : 'This athlete does not have any followers yet.';
  }
  return isOwn ? 'You are not following anyone yet.' : 'This athlete is not following anyone.';
}

export default function FollowListScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const theme = useTheme();
  const me = useCurrentUserId();
  const resolve = useUserResolver();
  const hidden = useHiddenAuthors();
  const [active, setActive] = useState<Tab>(tab === 'following' ? 'Following' : 'Followers');
  const [lists, setLists] = useState<Record<Tab, Loaded>>({
    Followers: { state: 'loading' },
    Following: { state: 'loading' },
  });
  const isOwn = !!id && id.toLowerCase() === me.toLowerCase();

  const load = useCallback(
    async (which: Tab) => {
      if (!id) return;
      setLists((l) => ({ ...l, [which]: { state: 'loading' } }));
      try {
        const address = id as `0x${string}`;
        const list =
          which === 'Followers'
            ? await services.follows.getFollowers(address)
            : await services.follows.getFollowing(address);
        setLists((l) => ({ ...l, [which]: { state: 'ready', addresses: list.addresses } }));
      } catch (e) {
        logger.warn(`[FollowList] Failed to load ${which}:`, e);
        setLists((l) => ({ ...l, [which]: { state: 'error' } }));
      }
    },
    [id]
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: load both lists once per athlete
  useEffect(() => {
    void load('Followers');
    void load('Following');
  }, [id]);

  const current = lists[active];
  const users = useMemo(
    () =>
      current.state === 'ready'
        ? withoutHidden(followListUsers(current.addresses, resolve), (u) => u.id, hidden)
        : [],
    [current, resolve, hidden]
  );

  const emptyText = emptyMessage(active === 'Followers', isOwn);

  const empty = () => {
    if (current.state === 'loading') {
      return <SkeletonRows count={SKELETON_ROWS} />;
    }
    if (current.state === 'error') {
      return (
        <ListMessage
          icon="cloud-offline-outline"
          text="Couldn't load this list. Check your connection and try again."
          action={{ label: 'Try again', onPress: () => void load(active) }}
        />
      );
    }
    return <ListMessage icon="people-outline" text={emptyText} />;
  };

  const renderItem = ({ item }: { item: SocialUser }) => (
    <PersonRow
      user={item}
      showFollow={item.id.toLowerCase() !== me.toLowerCase()}
      onPress={() => router.push(`/athletes/${item.id}`)}
    />
  );

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle" accessibilityRole="header">
            {isOwn ? 'You' : 'Connections'}
          </ThemedText>
          <View style={styles.spacer} />
        </View>
        <UnderlineTabs<Tab> tabs={TABS} active={active} onChange={setActive} />
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.list}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  spacer: { width: 24 },
  list: { flexGrow: 1, paddingBottom: Spacing.four },
});
