import type { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther } from 'viem';
import { getActiveProfileId } from '@/backends/activeProfile';
import { clubKey, eventKey, setClubMember, setEventMember } from '@/backends/membership';
import { PROFILES } from '@/backends/profiles';
import { CommunityCard, JoinButton } from '@/components/community-card';
import { EventCard } from '@/components/event-card';
import { ChipRow, FilterChips, type SportFilter } from '@/components/filter-chips';
import { GroupsEmptyState } from '@/components/groups-empty-state';
import { OutlinePill } from '@/components/outline-pill';
import { SearchBar } from '@/components/search-bar';
import { StaleBanner } from '@/components/stale-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBarAction } from '@/components/top-bar-action';
import { UnderlineTabs } from '@/components/underline-tabs';
import { SPORT_ICONS } from '@/constants/activity';
import { stockImageFor } from '@/constants/stockImages';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useChainAction } from '@/hooks/useChainAction';
import { useGroupsData } from '@/hooks/useGroupsData';
import { useOutboxEntries } from '@/hooks/useOutbox';
import { useUserResolver } from '@/hooks/useSocialUser';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useActivityStore } from '@/stores/activityStore';
import {
  type Club,
  filterClubs,
  filterEvents,
  orderClubs,
  useCommunityStore,
} from '@/stores/communityStore';
import type { ActivityType } from '@/types';
import type { ChallengeEvent } from '@/types/event';
import { sameAddress, shortAddress } from '@/utils/address';
import {
  CHALLENGE_FILTERS,
  CHALLENGE_STATUS_LABEL,
  type ChallengeFilter,
  challengeTimeLeft,
  matchesChallengeFilter,
  orderChallenges,
} from '@/utils/challengeFilter';
import { clubRowSubtitle } from '@/utils/clubRow';
import { confirmLeave } from '@/utils/confirmLeave';
import { formatDateRange, formatDayYear } from '@/utils/dates';
import { deliveryOf } from '@/utils/deliveryState';
import { eventStatus } from '@/utils/eventStatus';
import { formatDistance, formatMemberCount, getDisplayName } from '@/utils/format';
import { groupsEmptyView } from '@/utils/groupsEmptyView';
import { defaultGroupTab, GROUP_TABS, type GroupTab } from '@/utils/groupTabs';
import { haptics } from '@/utils/haptics';
import { loadFailureView } from '@/utils/loadFailureView';
import { orderEvents } from '@/utils/otherEvents';

const TABS = GROUP_TABS;
type TabKey = GroupTab;

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

export default function CommunityScreen() {
  const router = useRouter();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const listRef = useRef<FlatList<Row>>(null);

  const hasActivities = useActivityStore((s) => s.activities.length > 0);
  const [activeTab, setActiveTab] = useState<TabKey>(() => defaultGroupTab({ hasActivities }));
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

  const filteredClubs = orderClubs(filterClubs(clubs, clubQuery, sportFilter), joinedClubIds);
  const filteredEvents = orderEvents(
    filterEvents(events, eventQuery, eventSportFilter),
    new Date()
  );

  const { address } = useChainAction();
  const { walletFailed, retry: retryWallet } = useViemWallet();
  const isEventHost = useCommunityStore((s) => s.isEventHost);
  const getUserById = useUserResolver();
  const [challengeFilter, setChallengeFilter] = useState<ChallengeFilter>('all');
  // A join or leave still on its way to the chain: shown on the card, but never blocks it.
  const outboxEntries = useOutboxEntries();
  const isSending = (key: string) => deliveryOf(outboxEntries, key) !== undefined;

  // A profile with no chain cannot read challenges, and a retry would fail the same way.
  const noChain = PROFILES[getActiveProfileId()].fakeChain;

  const { challenges, challengesError, refreshing, onRefresh } = useGroupsData({
    activeTab,
    address,
    noChain,
  });

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
      image={stockImageFor('club', item.id)}
      title={item.name}
      lines={[
        clubRowSubtitle(item),
        sameAddress(item.owner, address ?? undefined) ? 'You run this club' : '',
      ]}
      onPress={() => router.push(`/clubs/${item.id}`)}
      // The owner has nothing to join; a disabled "Joined" pill only squeezed the club name.
      trailing={
        sameAddress(item.owner, address ?? undefined) ? undefined : (
          <JoinButton
            joined={joinedClubIds.includes(item.id)}
            pending={isSending(clubKey(item.id))}
            name={item.name}
            onPress={() => handleJoinClub(item)}
          />
        )
      }
    />
  );

  const renderEvent = (item: ChallengeEvent) => (
    <EventCard
      sport={item.sportType}
      icon={SPORT_ICON_NAME(item.sportType)}
      image={stockImageFor('event', item.id)}
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
      : shortAddress(opponentAddress);
    return (
      <CommunityCard
        icon="flag"
        image={stockImageFor('challenge', item.id)}
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

  const emptyView = groupsEmptyView({
    tab: activeTab,
    clubs: { total: clubs.length, loading: clubsLoading, error: !!clubsError },
    events: {
      total: events.length,
      loading: eventsLoading,
      error: !!eventsError,
      registryDeployed: services.event.isEventRegistryDeployed(),
    },
    challenges: {
      loaded: challenges !== null,
      total: challenges?.length ?? 0,
      error: !!challengesError,
    },
    challengeFilter,
    noChain,
    walletFailed,
    hasAddress: !!address,
  });
  const renderEmpty = () => (
    <GroupsEmptyState
      view={emptyView}
      onRetry={onRefresh}
      onRetryWallet={retryWallet}
      onShowAllChallenges={() => setChallengeFilter('all')}
    />
  );

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
