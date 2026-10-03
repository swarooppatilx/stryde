import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, RefreshControl, SectionList, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { CommunityCard } from '@/components/community-card';
import { FilterChips, type SportFilter } from '@/components/filter-chips';
import { ListMessage } from '@/components/list-message';
import { SearchBar } from '@/components/search-bar';
import { ActivityRow, PersonRow, RecentRow } from '@/components/search-rows';
import { SegmentedChoice } from '@/components/segmented-choice';
import { SkeletonRows } from '@/components/skeleton-rows';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSportLabel } from '@/constants/activity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useGoBack } from '@/hooks/useGoBack';
import { useHiddenAuthors } from '@/hooks/useHiddenAuthors';
import {
  type Club,
  filterClubs,
  filterEvents,
  orderClubs,
  useCommunityStore,
} from '@/stores/communityStore';
import { useRecentSearchStore } from '@/stores/recentSearchStore';
import { searchActivities, searchUsers, useSocialStore } from '@/stores/socialStore';
import type { ChallengeEvent } from '@/types/event';
import { formatDateRange } from '@/utils/dates';
import { buildProfileDeepLink } from '@/utils/deepLink';
import { eventStatus } from '@/utils/eventStatus';
import { formatDistance, formatRelativeTime, getDisplayName } from '@/utils/format';
import { logger } from '@/utils/logger';
import { orderEvents } from '@/utils/otherEvents';
import { countOf } from '@/utils/plural';
import type { RecentSearch } from '@/utils/recentSearches';
import { resultLimit, SEARCH_SCOPES, type SearchScope, scopeShows } from '@/utils/searchScope';
import type { SocialActivity, SocialUser } from '@/utils/socialSelectors';
import { matchesSportFilter } from '@/utils/sportFilter';
import { suggestPeople } from '@/utils/suggestedPeople';
import { Toast } from '@/utils/toast';
import { withoutHidden } from '@/utils/withoutHidden';

const SEARCH_DEBOUNCE_MS = 250;
const RECENTS_SHOWN = 3;
const SUGGESTIONS_SHOWN = 8;
const SKELETON_ROWS = 6;

type Section =
  | { key: 'recent'; title: string; data: RecentSearch[] }
  | { key: 'suggested'; title: string; data: SocialUser[] }
  | { key: 'people'; title: string; data: SocialUser[] }
  | { key: 'activities'; title: string; data: SocialActivity[] }
  | { key: 'clubs'; title: string; data: Club[] }
  | { key: 'events'; title: string; data: ChallengeEvent[] };

type LoadState = 'loading' | 'ready' | 'error';

export default function SearchScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const [query, setQuery] = useState('');
  const allUsers = useSocialStore((s) => s.users);
  const allActivities = useSocialStore((s) => s.activities);
  const following = useSocialStore((s) => s.following);
  const me = useCurrentUserId();
  const fetchUsers = useSocialStore((s) => s.fetchUsers);
  const fetchActivities = useSocialStore((s) => s.fetchActivities);
  const recents = useRecentSearchStore((s) => s.recents);
  const remember = useRecentSearchStore((s) => s.remember);
  const forget = useRecentSearchStore((s) => s.forget);
  const clearRecents = useRecentSearchStore((s) => s.clear);
  const hidden = useHiddenAuthors();
  const [showAllRecents, setShowAllRecents] = useState(false);

  const [loadState, setLoadState] = useState<LoadState>(
    Object.keys(allUsers).length > 0 ? 'ready' : 'loading'
  );
  const load = useCallback(async () => {
    setLoadState('loading');
    const [usersOk] = await Promise.all([fetchUsers(), fetchActivities()]);
    setLoadState(usersOk ? 'ready' : 'error');
  }, [fetchUsers, fetchActivities]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only fetch on open when nothing is cached
  useEffect(() => {
    if (loadState === 'loading') void load();
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const trimmedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const typing = query.trim() !== trimmedQuery;

  // If the query looks like an ENS name (e.g. "vitalik.eth"), resolve it to
  // an address and fold any matching registered user into the results.
  const [ensResolvedAddress, setEnsResolvedAddress] = useState<string | null>(null);
  useEffect(() => {
    if (!trimmedQuery.includes('.')) {
      setEnsResolvedAddress(null);
      return;
    }
    let cancelled = false;
    services.ens
      .resolveEnsAddress(trimmedQuery)
      .then((addr) => {
        if (!cancelled) setEnsResolvedAddress(addr);
      })
      // A failed lookup just means no ENS match; it must not surface as an unhandled rejection.
      .catch(() => {
        if (!cancelled) setEnsResolvedAddress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [trimmedQuery]);

  const users = useMemo(() => {
    if (trimmedQuery.length === 0) return [];
    const textResults = withoutHidden(searchUsers(allUsers, trimmedQuery), (u) => u.id, hidden);
    if (!ensResolvedAddress) return textResults;
    const ensMatches = searchUsers(allUsers, ensResolvedAddress);
    const merged = [...textResults];
    for (const u of ensMatches) {
      if (!merged.some((m) => m.id === u.id)) merged.push(u);
    }
    return merged;
  }, [trimmedQuery, allUsers, ensResolvedAddress, hidden]);
  const [sport, setSport] = useState<SportFilter>('all');
  const activities = useMemo(
    () =>
      trimmedQuery.length > 0
        ? withoutHidden(
            searchActivities(allActivities, trimmedQuery, me, following),
            (a) => a.userId,
            hidden
          ).filter((a) => matchesSportFilter(sport, a.activityType))
        : [],
    [trimmedQuery, allActivities, me, following, hidden, sport]
  );

  const [scope, setScope] = useState<SearchScope>('all');
  const hasQuery = query.trim().length > 0;
  const allClubs = useCommunityStore((s) => s.clubs);
  const allEvents = useCommunityStore((s) => s.events);
  const clubs = useMemo(
    () =>
      trimmedQuery.length > 0
        ? orderClubs(filterClubs(allClubs, trimmedQuery), []).slice(0, resultLimit(scope, 3))
        : [],
    [trimmedQuery, allClubs, scope]
  );
  const events = useMemo(
    () =>
      trimmedQuery.length > 0
        ? orderEvents(filterEvents(allEvents, trimmedQuery), new Date()).slice(
            0,
            resultLimit(scope, 3)
          )
        : [],
    [trimmedQuery, allEvents, scope]
  );
  const suggestions = useMemo(
    () => suggestPeople(allUsers, new Set([...following, ...hidden]), me, SUGGESTIONS_SHOWN),
    [allUsers, following, hidden, me]
  );

  const sections = useMemo<Section[]>(() => {
    if (hasQuery) {
      const found: Section[] = [];
      if (users.length > 0 && scopeShows(scope, 'people'))
        found.push({ key: 'people', title: 'People', data: users });
      if (activities.length > 0 && scopeShows(scope, 'activities'))
        found.push({ key: 'activities', title: 'Activities', data: activities });
      if (clubs.length > 0 && scopeShows(scope, 'clubs'))
        found.push({ key: 'clubs', title: 'Clubs', data: clubs });
      if (events.length > 0 && scopeShows(scope, 'events'))
        found.push({ key: 'events', title: 'Events', data: events });
      return found;
    }
    const idle: Section[] = [];
    if (recents.length > 0) {
      idle.push({
        key: 'recent',
        title: 'Recent',
        data: showAllRecents ? recents : recents.slice(0, RECENTS_SHOWN),
      });
    }
    if (suggestions.length > 0)
      idle.push({ key: 'suggested', title: 'People you may know', data: suggestions });
    return idle;
  }, [hasQuery, users, activities, clubs, events, recents, showAllRecents, suggestions, scope]);

  const inviteFriends = async () => {
    try {
      await Share.share({ message: `Join me on Stryde\n${buildProfileDeepLink(me)}` });
    } catch (error) {
      logger.warn('[Search] Invite share failed', error);
      Toast.fail('Could not open sharing', 1);
    }
  };

  const openUser = (user: SocialUser) => {
    remember({ kind: 'user', id: user.id, label: getDisplayName(user) });
    router.push(`/athletes/${user.id}`);
  };
  const openActivity = (activity: SocialActivity) => {
    remember({
      kind: 'activity',
      id: activity.id,
      label: activity.name || getSportLabel(activity.activityType),
    });
    router.push(`/activities/${activity.id}`);
  };
  const openRecent = (entry: RecentSearch) =>
    router.push(entry.kind === 'user' ? `/athletes/${entry.id}` : `/activities/${entry.id}`);

  const renderItem = ({ item, section }: { item: unknown; section: Section }) => {
    switch (section.key) {
      case 'recent': {
        const entry = item as RecentSearch;
        return (
          <RecentRow
            entry={entry}
            onPress={() => openRecent(entry)}
            onRemove={() => forget(entry)}
          />
        );
      }
      case 'activities': {
        const activity = item as SocialActivity;
        return (
          <ActivityRow
            activity={activity}
            detail={[
              formatDistance(activity.distance, unitSystem),
              formatRelativeTime(activity.createdAt, true),
            ].join(' · ')}
            onPress={() => openActivity(activity)}
          />
        );
      }
      case 'clubs': {
        const club = item as Club;
        return (
          <CommunityCard
            icon="people-outline"
            title={club.name}
            lines={[club.location, countOf(club.memberCount, 'member', 'members')]}
            onPress={() => router.push(`/clubs/${club.id}`)}
          />
        );
      }
      case 'events': {
        const event = item as ChallengeEvent;
        return (
          <CommunityCard
            icon="calendar-outline"
            title={event.title}
            lines={[
              eventStatus(event.startDate, event.endDate).label,
              formatDateRange(event.startDate, event.endDate),
            ]}
            onPress={() => router.push(`/events/${event.id}`)}
          />
        );
      }
      default: {
        const user = item as SocialUser;
        return (
          <PersonRow
            user={user}
            showFollow={user.id.toLowerCase() !== me.toLowerCase()}
            onPress={() => openUser(user)}
          />
        );
      }
    }
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <ThemedView type="background" style={styles.sectionHeader}>
      <ThemedText type="eyebrow" style={{ color: theme.textSecondary }} accessibilityRole="header">
        {section.title}
      </ThemedText>
      {section.key === 'recent' && (
        <View style={styles.sectionActions}>
          {!showAllRecents && recents.length > RECENTS_SHOWN && (
            <Tappable
              onPress={() => setShowAllRecents(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="See all recent searches"
            >
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                See all
              </ThemedText>
            </Tappable>
          )}
          <Tappable
            onPress={clearRecents}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear recent searches"
          >
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>
              Clear
            </ThemedText>
          </Tappable>
        </View>
      )}
    </ThemedView>
  );

  const listEmpty = () => {
    if (loadState === 'loading') {
      return <SkeletonRows count={SKELETON_ROWS} variant="nameAndMeta" />;
    }
    if (loadState === 'error' && Object.keys(allUsers).length === 0) {
      return (
        <ListMessage
          icon="cloud-offline-outline"
          text="Couldn't load athletes. Check your connection and try again."
          action={{ label: 'Try again', onPress: () => void load() }}
        />
      );
    }
    if (typing) return null;
    if (hasQuery) {
      return (
        <View accessibilityLiveRegion="polite">
          <ListMessage icon="search-outline" text={`No results for "${trimmedQuery}"`} />
        </View>
      );
    }
    return (
      <ListMessage
        icon="search"
        text="Search for athletes to follow, an activity, a club or an event."
      />
    );
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.searchBar}>
          <Tappable
            onPress={goBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Tappable>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onSubmit={Keyboard.dismiss}
            placeholder="Search people, activities, clubs..."
            accessibilityLabel="Search people, activities, clubs and events"
            autoFocus
            style={styles.inputWrapper}
          />
        </ThemedView>

        {hasQuery && (
          <View style={styles.scopeRow}>
            <SegmentedChoice<SearchScope>
              options={SEARCH_SCOPES}
              selected={scope}
              onSelect={setScope}
              compact
            />
          </View>
        )}
        {hasQuery && (scope === 'all' || scope === 'activities') && (
          <View style={styles.scopeRow}>
            <FilterChips value={sport} onChange={setSport} />
          </View>
        )}

        <SectionList<unknown, Section>
          sections={sections}
          keyExtractor={(item, index) => {
            const row = item as { id?: string; kind?: string };
            return `${row.kind ?? ''}${row.id ?? index}`;
          }}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          ListEmptyComponent={listEmpty}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.scroll}
          refreshControl={
            hasQuery ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.brand.primary}
                colors={[theme.brand.primary]}
              />
            ) : undefined
          }
        />

        <View style={styles.invite}>
          <AppButton variant="secondary" onPress={inviteFriends}>
            Invite friends
          </AppButton>
        </View>
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
  inputWrapper: { flex: 1, borderWidth: 0 },
  scroll: { paddingBottom: Spacing.four, flexGrow: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  scopeRow: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  invite: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  sectionActions: { flexDirection: 'row', gap: Spacing.three },
  back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
