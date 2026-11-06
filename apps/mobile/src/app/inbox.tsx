import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { FollowButton } from '@/components/follow-button';
import { ListMessage } from '@/components/list-message';
import { StaleBanner } from '@/components/stale-banner';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserAvatar } from '@/components/user-avatar';
import { INBOX_COPY } from '@/constants/copy';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useGoBack } from '@/hooks/useGoBack';
import { useInbox } from '@/hooks/useInbox';
import { useSocialStore } from '@/stores/socialStore';
import { shortAddress } from '@/utils/address';
import { formatRelativeTime, getDisplayName } from '@/utils/format';
import type { InboxItem } from '@/utils/inbox';

export default function InboxScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const theme = useTheme();
  const users = useSocialStore((s) => s.users);
  const markInboxSeen = useSocialStore((s) => s.markInboxSeen);
  const { items, seenAt } = useInbox();
  const feedStatus = useSocialStore((s) => s.feedStatus);
  const me = useCurrentUserId();
  const fetchActivities = useSocialStore((s) => s.fetchActivities);
  const syncFollowing = useSocialStore((s) => s.syncFollowing);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([fetchActivities(), me ? syncFollowing(me as `0x${string}`) : null]);
    setRefreshing(false);
  }, [fetchActivities, syncFollowing, me]);
  // Unread markers must survive the moment everything is marked read on open.
  const openedWithSeenAt = useRef(seenAt);

  // What counts as seen is the newest item's own time, so the phone's clock cannot hide or invent unread.
  const newest = items[0]?.at.getTime() ?? 0;
  useEffect(() => {
    markInboxSeen(newest);
  }, [markInboxSeen, newest]);

  const rows = useMemo(
    () =>
      items.map((item) => {
        const actor = users[item.actorId.toLowerCase()];
        return {
          item,
          name: actor ? getDisplayName(actor) : shortAddress(item.actorId),
          avatar: actor?.avatar,
          unread: item.at.getTime() > openedWithSeenAt.current,
        };
      }),
    [items, users]
  );

  const open = (item: InboxItem) =>
    item.kind !== 'follow' && item.activityId
      ? router.push(`/activities/${item.activityId}`)
      : router.push(`/athletes/${item.actorId}`);

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Tappable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={goBack}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="headline" accessibilityRole="header">
            Notifications
          </ThemedText>
        </View>
        <FlatList
          data={rows}
          keyExtractor={(row) => row.item.id}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.brand.primary}
              colors={[theme.brand.primary]}
            />
          }
          ListHeaderComponent={
            feedStatus === 'error' && rows.length > 0 ? (
              <View style={styles.banner}>
                <StaleBanner onRetry={() => void onRefresh()} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <ListMessage
                icon="notifications-outline"
                text="New followers, kudos and comments on your activities show up here."
              />
              <AppButton variant="secondary" onPress={() => router.push('/search')}>
                Find athletes
              </AppButton>
            </View>
          }
          renderItem={({ item: row }) => (
            <Tappable
              activeOpacity={0.7}
              onPress={() => open(row.item)}
              accessibilityRole="button"
              accessibilityLabel={`${row.unread ? 'New. ' : ''}${row.name}${INBOX_COPY[row.item.kind]}. ${formatRelativeTime(row.item.at)}`}
              style={[
                styles.row,
                { backgroundColor: row.unread ? theme.backgroundElement : 'transparent' },
              ]}
            >
              <UserAvatar uri={row.avatar} name={row.name} size="md" />
              <View style={styles.rowText}>
                <ThemedText numberOfLines={2}>
                  <ThemedText style={styles.bold}>{row.name}</ThemedText>
                  {INBOX_COPY[row.item.kind]}
                </ThemedText>
                {row.item.text ? (
                  <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                    {row.item.text}
                  </ThemedText>
                ) : null}
                <ThemedText type="small" themeColor="textSecondary">
                  {formatRelativeTime(row.item.at)}
                </ThemedText>
              </View>
              {row.item.kind === 'follow' ? (
                <FollowButton userId={row.item.actorId} name={row.name} />
              ) : null}
            </Tappable>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  back: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.one },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
  },
  rowText: { flex: 1, gap: Spacing.half },
  bold: { fontWeight: '700' },
});
