import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { ChipRow } from '@/components/filter-chips';
import { FollowButton } from '@/components/follow-button';
import { ListMessage } from '@/components/list-message';
import { StaleBanner } from '@/components/stale-banner';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserAvatar } from '@/components/user-avatar';
import { INBOX_COPY, INBOX_EMPTY, INBOX_FILTER, INBOX_LINE } from '@/constants/copy';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useGoBack } from '@/hooks/useGoBack';
import { useInbox } from '@/hooks/useInbox';
import { useClubStore } from '@/stores/clubStore';
import { useCommunityStore } from '@/stores/communityStore';
import { useSocialStore } from '@/stores/socialStore';
import { shortAddress } from '@/utils/address';
import { formatDateTime } from '@/utils/dates';
import { formatRelativeTime, getDisplayName } from '@/utils/format';
import {
  groupsPresent,
  type InboxGroup,
  type InboxItem,
  inboxGroupOf,
  readAllCutoff,
  unreadByGroup,
} from '@/utils/inbox';

const MAX_CLUBS_LOADED = 10;

type Filter = Exclude<InboxGroup, 'mention'> | 'all';

/** The line an item reads as, split into the bold name (if someone did it) and the rest. */
function lineOf(item: InboxItem, name: string, now: number): { lead: string; rest: string } {
  const title = item.title ?? 'a club';
  switch (item.kind) {
    case 'follow':
    case 'comment':
    case 'kudos':
      return { lead: name, rest: INBOX_COPY[item.kind] };
    case 'club_post':
      return { lead: name, rest: INBOX_LINE.club_post(title) };
    case 'club_request':
      return { lead: name, rest: INBOX_LINE.club_request(title) };
    case 'club_approved':
      return { lead: '', rest: INBOX_LINE.club_approved(title) };
    case 'event_reminder': {
      const started = (item.startsAt?.getTime() ?? now) <= now;
      return { lead: '', rest: INBOX_LINE.event_reminder(title, started) };
    }
    case 'milestone':
      return { lead: '', rest: INBOX_LINE.milestone(title) };
    case 'mention':
      return { lead: name, rest: '' };
  }
}

const ICON: Partial<Record<InboxItem['kind'], 'people' | 'calendar' | 'ribbon'>> = {
  club_approved: 'people',
  event_reminder: 'calendar',
  milestone: 'ribbon',
};

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
  const [readCutoff, setReadCutoff] = useState(openedWithSeenAt.current);
  const [filter, setFilter] = useState<Filter>('all');
  const joinedClubIds = useCommunityStore((s) => s.joinedClubIds);
  const loadClub = useClubStore((s) => s.load);
  // Club posts and requests come from each club's own feed, so the joined ones are fetched here.
  useEffect(() => {
    for (const id of joinedClubIds.slice(0, MAX_CLUBS_LOADED)) void loadClub(id);
  }, [joinedClubIds, loadClub]);

  // What counts as seen is the newest item's own time, so the phone's clock cannot hide or invent unread.
  const newest = items[0]?.at.getTime() ?? 0;
  useEffect(() => {
    markInboxSeen(newest);
  }, [markInboxSeen, newest]);

  const present = useMemo(() => groupsPresent(items), [items]);
  const unreadCounts = useMemo(() => unreadByGroup(items, readCutoff), [items, readCutoff]);
  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);
  const filterOptions = useMemo(() => {
    const labelled = (value: Filter, count: number) => ({
      value,
      label: count > 0 ? `${INBOX_FILTER[value]} ${count}` : INBOX_FILTER[value],
    });
    return [
      labelled('all', totalUnread),
      ...present.flatMap((group) =>
        group === 'mention' ? [] : [labelled(group, unreadCounts[group] ?? 0)]
      ),
    ];
  }, [present, unreadCounts, totalUnread]);
  // A filter whose items are all gone falls back to everything, so the list is never stuck empty.
  const activeFilter: Filter = filter === 'all' || present.includes(filter) ? filter : 'all';

  const now = Date.now();
  const rows = useMemo(
    () =>
      items
        .filter((item) => activeFilter === 'all' || inboxGroupOf(item.kind) === activeFilter)
        .map((item) => {
          const actor = item.actorId ? users[item.actorId.toLowerCase()] : undefined;
          const name = actor ? getDisplayName(actor) : shortAddress(item.actorId ?? '');
          return {
            item,
            name,
            avatar: actor?.avatar,
            unread: item.at.getTime() > readCutoff,
          };
        }),
    [items, users, activeFilter, readCutoff]
  );

  const markAllRead = () => {
    const cutoff = readAllCutoff(items, readCutoff);
    setReadCutoff(cutoff);
    markInboxSeen(cutoff);
  };

  const open = (item: InboxItem) => {
    if (item.clubId) return router.push(`/clubs/${item.clubId}`);
    if (item.eventId) return router.push(`/events/${item.eventId}`);
    if (item.kind === 'milestone')
      return router.push(`/badges/${item.id.slice('milestone:'.length)}`);
    if (item.kind !== 'follow' && item.activityId) {
      return router.push(`/activities/${item.activityId}`);
    }
    if (item.actorId) return router.push(`/athletes/${item.actorId}`);
  };

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
          <View style={styles.headerSpacer} />
          <AppButton
            variant="ghost"
            size="small"
            fullWidth={false}
            disabled={totalUnread === 0}
            onPress={markAllRead}
          >
            Mark all read
          </AppButton>
        </View>
        {filterOptions.length > 2 ? (
          <ChipRow
            options={filterOptions}
            value={activeFilter}
            onChange={setFilter}
            contentStyle={styles.chips}
          />
        ) : null}
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
              <ListMessage icon="notifications-outline" text={INBOX_EMPTY[activeFilter]} />
              {activeFilter === 'all' ? (
                <AppButton variant="secondary" onPress={() => router.push('/search')}>
                  Find athletes
                </AppButton>
              ) : null}
            </View>
          }
          renderItem={({ item: row }) => {
            const line = lineOf(row.item, row.name, now);
            const icon = ICON[row.item.kind];
            return (
              <Tappable
                activeOpacity={0.7}
                onPress={() => open(row.item)}
                accessibilityRole="button"
                accessibilityLabel={`${row.unread ? 'New. ' : ''}${line.lead}${line.rest}. ${formatRelativeTime(row.item.at)}`}
                style={[
                  styles.row,
                  { backgroundColor: row.unread ? theme.backgroundElement : 'transparent' },
                ]}
              >
                {row.item.actorId ? (
                  <UserAvatar uri={row.avatar} name={row.name} size="md" />
                ) : (
                  <View style={[styles.iconBadge, { backgroundColor: theme.backgroundSelected }]}>
                    <Ionicons
                      name={icon ?? 'notifications'}
                      size={20}
                      color={theme.brand.primary}
                    />
                  </View>
                )}
                <View style={styles.rowText}>
                  <ThemedText numberOfLines={2}>
                    {line.lead ? <ThemedText style={styles.bold}>{line.lead}</ThemedText> : null}
                    {line.rest}
                  </ThemedText>
                  {row.item.text ? (
                    <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                      {row.item.text}
                    </ThemedText>
                  ) : null}
                  {row.item.startsAt ? (
                    <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                      {formatDateTime(row.item.startsAt)}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatRelativeTime(row.item.at)}
                  </ThemedText>
                </View>
                {row.item.kind === 'follow' && row.item.actorId ? (
                  <FollowButton userId={row.item.actorId} name={row.name} />
                ) : null}
              </Tappable>
            );
          }}
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
  headerSpacer: { flex: 1 },
  chips: { paddingHorizontal: Spacing.three },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
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
