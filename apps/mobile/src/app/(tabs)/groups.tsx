import type { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther } from 'viem';
import { getActiveProfileId } from '@/backends/activeProfile';
import { clubKey, eventKey, setClubMember, setEventMember } from '@/backends/membership';
import { PROFILES } from '@/backends/profiles';
import { CommunityCard, JoinButton } from '@/components/community-card';
import { EventCard } from '@/components/event-card';
import { ChipRow, FilterChips, type SportFilter } from '@/components/filter-chips';
import { ListLoading, ListMessage } from '@/components/list-message';
import { OutlinePill } from '@/components/outline-pill';
import { SearchBar } from '@/components/search-bar';
import { StaleBanner } from '@/components/stale-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBarAction } from '@/components/top-bar-action';
import { UnderlineTabs } from '@/components/underline-tabs';
import { SPORT_ICONS } from '@/constants/activity';
import { COMMUNITY_COPY } from '@/constants/copy';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useChainAction } from '@/hooks/useChainAction';
import { useOutboxEntries } from '@/hooks/useOutbox';
import { useUserResolver } from '@/hooks/useSocialUser';
import {
  type Club,
  filterClubs,
  filterEvents,
  orderClubs,
  useCommunityStore,
} from '@/stores/communityStore';
import type { ActivityType } from '@/types';
import type { ChallengeEvent } from '@/types/event';
import { sameAddress } from '@/utils/address';
import {
  CHALLENGE_FILTERS,
  CHALLENGE_STATUS_LABEL,
  type ChallengeFilter,
  challengeTimeLeft,
  matchesChallengeFilter,
  orderChallenges,
} from '@/utils/challengeFilter';
import { confirmLeave } from '@/utils/confirmLeave';
import { formatDateRange, formatDayYear } from '@/utils/dates';
import { deliveryOf } from '@/utils/deliveryState';
import { eventStatus } from '@/utils/eventStatus';
import { formatDistance, formatMemberCount, getDisplayName } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { loadFailureView } from '@/utils/loadFailureView';
import { logger } from '@/utils/logger';
import { orderEvents } from '@/utils/otherEvents';
import { isStale } from '@/utils/staleness';

const TABS = ['Clubs', 'Events', 'Challenges'] as const;
type TabKey = (typeof TABS)[number];

type ChallengeItem = Awaited<ReturnType<typeof services.challenge.getUserChallenges>>[number];

type Row =
  | { kind: 'club'; club: Club }
  | { kind: 'event'; event: ChallengeEvent }
  | { kind: 'challenge'; challenge: ChallengeItem };

function communityRows({
  tab,
  clubs,
  events,
  challenges,
  challengeFilter,
  me,
}: {
  tab: TabKey;
  clubs: Club[];
  events: ChallengeEvent[];
  challenges: ChallengeItem[] | null;
  challengeFilter: ChallengeFilter;
  me: string | undefined;
}): Row[] {
  if (tab === 'Clubs') return clubs.map((club) => ({ kind: 'club', club }));
  if (tab === 'Events') return events.map((event) => ({ kind: 'event', event }));
  return orderChallenges(
    (challenges ?? []).filter((challenge) =>
      matchesChallengeFilter(challenge, challengeFilter, me)
    ),
    me
  ).map((challenge) => ({ kind: 'challenge', challenge }));
}

const SPORT_ICON_NAME = (sport: ActivityType | 'multi'): keyof typeof Ionicons.glyphMap => {
  if (sport === 'multi') return 'fitness';
  return (SPORT_ICONS[sport] ?? 'walk') as keyof typeof Ionicons.glyphMap;
};

/** How long a Groups list counts as fresh when the tab regains focus. */
const FOCUS_REFRESH_MS = 30_000;

export default function CommunityScreen() {
  const router = useRouter();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const listRef = useRef<FlatList<Row>>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('Clubs');
  const [clubQuery, setClubQuery] = useState('');
  const [eventQuery, setEventQuery] = useState('');
  const [sportFilter, setSportFilter] = useState<SportFilter>('all');
  const [eventSportFilter, setEventSportFilter] = useState<SportFilter>('all');

  const joinedEvents = useCommunityStore((s) => s.joinedEvents);
  const clubs = useCommunityStore((s) => s.clubs);
  const events = useCommunityStore((s) => s.events);
  const clubsLoading = useCommunityStore((s) => s.clubsLoading);
  const clubsError = useCommunityStore((s) => s.clubsError);
  const eventsError = useCommunityStore((s) => s.eventsError);
  const eventsLoading = useCommunityStore((s) => s.eventsLoading);
  const joinedClubIds = useCommunityStore((s) => s.joinedClubIds);
  const fetchClubs = useCommunityStore((s) => s.fetchClubs);
  const fetchJoinedClubs = useCommunityStore((s) => s.fetchJoinedClubs);
  const fetchEvents = useCommunityStore((s) => s.fetchEvents);
  const fetchJoinedEvents = useCommunityStore((s) => s.fetchJoinedEvents);

  const filteredClubs = orderClubs(filterClubs(clubs, clubQuery, sportFilter), joinedClubIds);
  const filteredEvents = orderEvents(
    filterEvents(events, eventQuery, eventSportFilter),
    new Date()
  );

  const { address } = useChainAction();
  const isEventHost = useCommunityStore((s) => s.isEventHost);
  const getUserById = useUserResolver();
  const [challenges, setChallenges] = useState<Awaited<
    ReturnType<typeof services.challenge.getUserChallenges>
  > | null>(null);
  const [challengesError, setChallengesError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [challengeFilter, setChallengeFilter] = useState<ChallengeFilter>('all');
  // A join or leave still on its way to the chain: shown on the card, but never blocks it.
  const outboxEntries = useOutboxEntries();
  const isSending = (key: string) => deliveryOf(outboxEntries, key) !== undefined;

  // A profile with no chain cannot read challenges, and a retry would fail the same way.
  const noChain = PROFILES[getActiveProfileId()].fakeChain;

  const loadChallenges = useCallback(async () => {
    if (!address || noChain) {
      setChallenges([]);
      return;
    }
    try {
      const list = await services.challenge.getUserChallenges(address);
      setChallenges(list.slice().reverse());
      setChallengesError(null);
    } catch (e) {
      // Keep any challenges already shown: a failed read is not "you have none".
      logger.warn('[Groups] Failed to load challenges:', e);
      setChallengesError(e instanceof Error ? e.message : 'Could not load challenges');
      setChallenges((previous) => previous ?? []);
    }
  }, [address, noChain]);

  // A different wallet must not see the last one's challenges while loading.
  // biome-ignore lint/correctness/useExhaustiveDependencies: address is the trigger
  useEffect(() => {
    setChallenges(null);
    setChallengesError(null);
  }, [address]);

  // Refresh when the tab is opened, but not on every flick between tabs: the lists only change
  // when someone acts, and each read goes to the chain. Pull-to-refresh always reloads.
  const loadedAt = useRef<Record<'challenges' | 'clubs' | 'events', number | null>>({
    challenges: null,
    clubs: null,
    events: null,
  });
  const dueFor = useCallback((list: 'challenges' | 'clubs' | 'events') => {
    const now = Date.now();
    if (!isStale(loadedAt.current[list], now, FOCUS_REFRESH_MS)) return false;
    loadedAt.current[list] = now;
    return true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'Challenges' || !address || !dueFor('challenges')) return;
      void loadChallenges();
    }, [activeTab, address, loadChallenges, dueFor])
  );

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'Clubs' || !dueFor('clubs')) return;
      fetchClubs();
    }, [activeTab, fetchClubs, dueFor])
  );

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'Clubs' || !address) return;
      fetchJoinedClubs(address);
    }, [activeTab, address, fetchJoinedClubs])
  );

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'Events' || !dueFor('events')) return;
      fetchEvents();
    }, [activeTab, fetchEvents, dueFor])
  );

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'Events' || !address) return;
      fetchJoinedEvents(address);
    }, [activeTab, address, fetchJoinedEvents])
  );

  const onRefresh = () => {
    if (activeTab === 'Challenges') {
      setRefreshing(true);
      void loadChallenges().finally(() => setRefreshing(false));
    } else if (activeTab === 'Clubs') {
      setRefreshing(true);
      void Promise.all([fetchClubs(), address ? fetchJoinedClubs(address) : null]).finally(() =>
        setRefreshing(false)
      );
    } else {
      setRefreshing(true);
      void Promise.all([fetchEvents(), address ? fetchJoinedEvents(address) : null]).finally(() =>
        setRefreshing(false)
      );
    }
  };

  const isClubs = activeTab === 'Clubs';
  const isEvents = activeTab === 'Events';
  const query = isClubs ? clubQuery : eventQuery;
  const setQuery = isClubs ? setClubQuery : setEventQuery;

  const handleTabChange = (tab: TabKey) => {
    haptics.selection();
    setActiveTab(tab);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const handleJoinClub = async (club: Club) => {
    haptics.impactMedium();
    if (joinedClubIds.includes(club.id)) {
      confirmLeave('club', club.name, () => void setClubMember(club.id, false));
      return;
    }
    await setClubMember(club.id, true);
  };

  const handleJoinEvent = async (event: ChallengeEvent) => {
    haptics.impactMedium();
    if (joinedEvents.includes(event.id)) {
      confirmLeave('event', event.title, () => void setEventMember(event.id, false));
      return;
    }
    await setEventMember(event.id, true);
  };

  const renderClub = (item: Club) => (
    <CommunityCard
      icon={SPORT_ICON_NAME(item.sportType)}
      title={item.name}
      lines={[
        item.location,
        `${formatMemberCount(item.memberCount)} ${item.memberCount === 1 ? 'member' : 'members'}`,
        sameAddress(item.owner, address ?? undefined) ? 'You run this club' : '',
      ]}
      onPress={() => router.push(`/clubs/${item.id}`)}
      trailing={
        <JoinButton
          joined={joinedClubIds.includes(item.id)}
          pending={isSending(clubKey(item.id))}
          name={item.name}
          onPress={() => handleJoinClub(item)}
          disabled={sameAddress(item.owner, address ?? undefined)}
        />
      }
    />
  );

  const renderEvent = (item: ChallengeEvent) => (
    <EventCard
      sport={item.sportType}
      icon={SPORT_ICON_NAME(item.sportType)}
      title={item.title}
      badge={formatDayYear(item.startDate)}
      lines={[
        eventStatus(item.startDate, item.endDate).label,
        formatDateRange(item.startDate, item.endDate) +
          (item.distanceGoal > 0 ? ` · ${formatDistance(item.distanceGoal, unitSystem)}` : ''),
        `${formatMemberCount(item.participantCount)} ${item.participantCount === 1 ? 'participant' : 'participants'}`,
        ...(isEventHost(item.id, address ?? undefined) ? ['You host this event'] : []),
      ]}
      onPress={() => router.push(`/events/${item.id}`)}
      trailing={
        <JoinButton
          joined={joinedEvents.includes(item.id)}
          pending={isSending(eventKey(item.id))}
          name={item.title}
          onPress={() => handleJoinEvent(item)}
          disabled={isEventHost(item.id, address ?? undefined)}
        />
      }
    />
  );

  const renderChallenge = (
    item: Awaited<ReturnType<typeof services.challenge.getUserChallenges>>[number]
  ) => {
    const isChallenger = sameAddress(item.challenger, address ?? undefined);
    const opponentAddress = isChallenger ? item.opponent : item.challenger;
    const opponentUser = getUserById(opponentAddress);
    const opponentName = opponentUser
      ? getDisplayName(opponentUser)
      : `${opponentAddress.slice(0, 6)}...${opponentAddress.slice(-4)}`;
    return (
      <CommunityCard
        icon="flag"
        title={`vs ${opponentName}`}
        lines={[
          `${formatDistance(Number(item.targetMetric), unitSystem)} · ${formatEther(item.stake)} ETH stake`,
          [
            matchesChallengeFilter(item, 'needs-you', address ?? undefined)
              ? 'Waiting for you to accept'
              : (CHALLENGE_STATUS_LABEL[item.status] ?? 'Unknown'),
            challengeTimeLeft(item.deadline, item.status, new Date()),
          ]
            .filter(Boolean)
            .join(' · '),
        ]}
        onPress={() => router.push(`/challenges/${item.id.toString()}`)}
      />
    );
  };

  const listData: Row[] = communityRows({
    tab: activeTab,
    clubs: filteredClubs,
    events: filteredEvents,
    challenges,
    challengeFilter,
    me: address ?? undefined,
  });

  const keyExtractor = (item: Row) => {
    if (item.kind === 'club') return item.club.id;
    if (item.kind === 'event') return item.event.id;
    return item.challenge.id.toString();
  };

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'club') return renderClub(item.club);
    if (item.kind === 'event') return renderEvent(item.event);
    return renderChallenge(item.challenge);
  };

  const loadError = (what: string) => (
    <ListMessage
      icon="cloud-offline-outline"
      text={`Couldn't load ${what}. Check your connection and try again.`}
      action={{ label: 'Retry', onPress: onRefresh }}
    />
  );

  const renderEmpty = () => {
    if (isClubs) {
      if (clubsLoading && clubs.length === 0) return <ListLoading />;
      if (clubsError && clubs.length === 0) return loadError('clubs');
      return (
        <ListMessage
          icon="people-outline"
          text={clubs.length === 0 ? 'No clubs yet. Create the first one!' : 'No clubs found'}
        />
      );
    }
    if (isEvents) {
      if (eventsLoading && events.length === 0) return <ListLoading />;
      if (eventsError && events.length === 0) return loadError('events');
      return (
        <ListMessage
          icon="trophy-outline"
          text={
            services.event.isEventRegistryDeployed()
              ? 'No events yet'
              : "Events aren't live on this network yet"
          }
        />
      );
    }
    if (noChain) return <ListMessage icon="flag-outline" text={COMMUNITY_COPY.challengesSandbox} />;
    if (challenges === null) return <ListLoading />;
    if (challengesError && challenges.length === 0) return loadError('challenges');
    if (challengeFilter !== 'all' && challenges.length > 0) {
      return (
        <ListMessage
          icon="flag-outline"
          text="No challenges here."
          action={{ label: 'Show all', onPress: () => setChallengeFilter('all') }}
        />
      );
    }
    return <ListMessage icon="flag-outline" text={COMMUNITY_COPY.challengesEmpty} />;
  };

  // Fixed above the list: the title and tabs stay put while the content scrolls.
  const pageHeader = (
    <ThemedView style={[styles.pageHeader, { backgroundColor: theme.backgroundElement }]}>
      <ThemedView style={[styles.header, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="title">Groups</ThemedText>
        <ThemedView style={[styles.headerActions, { backgroundColor: theme.backgroundElement }]}>
          <TopBarAction
            icon="search-outline"
            label="Search"
            onPress={() => router.push('/search')}
          />
        </ThemedView>
      </ThemedView>
      <UnderlineTabs
        tabs={TABS}
        active={activeTab}
        onChange={handleTabChange}
        style={styles.tabs}
      />
    </ThemedView>
  );

  // A refresh that fails over a list already on screen keeps the list and says so above it.
  const activeLoadState = () => {
    if (isClubs) return { failed: !!clubsError, hasCached: clubs.length > 0 };
    if (isEvents) return { failed: !!eventsError, hasCached: events.length > 0 };
    return { failed: !!challengesError, hasCached: (challenges?.length ?? 0) > 0 };
  };
  const failedOverCache = loadFailureView(activeLoadState());

  const listHeader = (
    <>
      {failedOverCache === 'banner' && <StaleBanner onRetry={onRefresh} />}
      {((isClubs && clubs.length > 0) || (isEvents && events.length > 0)) && (
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={isClubs ? 'Search clubs...' : 'Search events...'}
          style={styles.searchBar}
        />
      )}

      {isClubs && clubs.length > 0 && <FilterChips value={sportFilter} onChange={setSportFilter} />}
      {isEvents && events.length > 0 && (
        <FilterChips value={eventSportFilter} onChange={setEventSportFilter} />
      )}

      {activeTab === 'Challenges' && (challenges?.length ?? 0) > 0 && (
        <ChipRow
          options={CHALLENGE_FILTERS}
          value={challengeFilter}
          onChange={setChallengeFilter}
        />
      )}

      {isClubs && (
        <OutlinePill
          style={styles.action}
          onPress={() => {
            haptics.tap();
            router.push('/create-club');
          }}
        >
          Create club
        </OutlinePill>
      )}
      {isEvents && services.event.isEventRegistryDeployed() && (
        <OutlinePill
          style={styles.action}
          onPress={() => {
            haptics.tap();
            router.push('/create-event');
          }}
        >
          Create event
        </OutlinePill>
      )}
      {activeTab === 'Challenges' && !noChain && (
        <OutlinePill
          style={styles.action}
          onPress={() => {
            haptics.tap();
            router.push('/create-challenge');
          }}
        >
          New challenge
        </OutlinePill>
      )}
    </>
  );

  return (
    <ThemedView type="background" style={styles.container}>
      <ThemedView style={{ backgroundColor: theme.backgroundElement }}>
        <SafeAreaView edges={['top']}>{pageHeader}</SafeAreaView>
      </ThemedView>
      <View style={styles.safeArea}>
        <FlatList
          ref={listRef}
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderRow}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={renderEmpty}
          extraData={[
            activeTab,
            clubsLoading,
            eventsLoading,
            clubsError,
            eventsError,
            challengesError,
            challenges,
            joinedClubIds,
            joinedEvents,
            outboxEntries,
          ]}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.brand.primary}
            />
          }
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tabs: { marginTop: Spacing.one },
  pageHeader: { paddingHorizontal: Spacing.four },
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
  },
  headerActions: { flexDirection: 'row', gap: Spacing.two },
  searchBar: {
    marginTop: Spacing.three,
  },
  action: { marginTop: Spacing.three },
});
