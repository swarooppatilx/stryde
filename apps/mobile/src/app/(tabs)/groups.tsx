import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther } from 'viem';

import { AppButton } from '@/components/button';
import { FilterChips, type SportFilter } from '@/components/filter-chips';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_ICONS } from '@/constants/activity';
import { ENV } from '@/constants/config';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTransactor } from '@/hooks/useTransactor';
import { useViemWallet } from '@/hooks/useViemWallet';
import { type Club, useCommunityStore } from '@/stores/communityStore';
import { useSocialStore } from '@/stores/socialStore';
import type { ActivityType } from '@/types';
import type { ChallengeEvent } from '@/types/event';
import { formatDistance as formatActivityDistance, getDisplayName } from '@/utils/format';
import { haptics } from '@/utils/haptics';

const TABS = ['Clubs', 'Events', 'Challenges'] as const;
type TabKey = (typeof TABS)[number];

type ChallengeItem = Awaited<ReturnType<typeof services.challenge.getUserChallenges>>[number];

type Row =
  | { kind: 'club'; club: Club }
  | { kind: 'event'; event: ChallengeEvent }
  | { kind: 'challenge'; challenge: ChallengeItem };

const CHALLENGE_STATUS_LABEL = ['Open', 'Accepted', 'Settled', 'Cancelled'];

const SPORT_ICON_NAME = (sport: ActivityType | 'multi'): keyof typeof Ionicons.glyphMap => {
  if (sport === 'multi') return 'fitness';
  return (SPORT_ICONS[sport] ?? 'walk') as keyof typeof Ionicons.glyphMap;
};

const formatMemberCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

const formatDistance = (meters: number) => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(0)}km`;
  return `${meters}m`;
};

const formatDateRange = (start: Date, end: Date) => {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
};

export default function CommunityScreen() {
  const router = useRouter();
  const theme = useTheme();
  const listRef = useRef<FlatList<Row>>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('Clubs');
  const [clubQuery, setClubQuery] = useState('');
  const [eventQuery, setEventQuery] = useState('');
  const [sportFilter, setSportFilter] = useState<SportFilter>('all');
  const [eventSportFilter, setEventSportFilter] = useState<SportFilter>('all');

  const searchClubs = useCommunityStore((s) => s.searchClubs);
  const searchEvents = useCommunityStore((s) => s.searchEvents);
  const joinedEvents = useCommunityStore((s) => s.joinedEvents);
  const clubs = useCommunityStore((s) => s.clubs);
  const events = useCommunityStore((s) => s.events);
  const clubsLoading = useCommunityStore((s) => s.clubsLoading);
  const eventsLoading = useCommunityStore((s) => s.eventsLoading);
  const joinedClubIds = useCommunityStore((s) => s.joinedClubIds);
  const fetchClubs = useCommunityStore((s) => s.fetchClubs);
  const fetchJoinedClubs = useCommunityStore((s) => s.fetchJoinedClubs);
  const applyClubMembership = useCommunityStore((s) => s.applyClubMembership);
  const fetchEvents = useCommunityStore((s) => s.fetchEvents);
  const fetchJoinedEvents = useCommunityStore((s) => s.fetchJoinedEvents);
  const applyEventJoin = useCommunityStore((s) => s.applyEventJoin);

  // searchClubs/searchEvents read the store via get(), so the data arrays must
  // be dependencies too — otherwise the lists never update after a fetch.
  // biome-ignore lint/correctness/useExhaustiveDependencies: clubs drives searchClubs' result
  const filteredClubs = useMemo(
    () => searchClubs(clubQuery, sportFilter),
    [clubs, clubQuery, sportFilter, searchClubs]
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: events drives searchEvents' result
  const filteredEvents = useMemo(
    () => searchEvents(eventQuery, eventSportFilter),
    [events, eventQuery, eventSportFilter, searchEvents]
  );

  const { wallet, address } = useViemWallet(ENV.CHAIN_MODE);
  const { transact } = useTransactor();
  const getUserById = useSocialStore((s) => s.getUserById);
  const [challenges, setChallenges] = useState<Awaited<
    ReturnType<typeof services.challenge.getUserChallenges>
  > | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingClubId, setPendingClubId] = useState<string | null>(null);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);

  const loadChallenges = useCallback(async () => {
    if (!address) {
      setChallenges([]);
      return;
    }
    try {
      const list = await services.challenge.getUserChallenges(address);
      setChallenges(list.slice().reverse());
    } catch {
      setChallenges([]);
    }
  }, [address]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'Challenges' || !address) return;
      setChallenges(null);
      loadChallenges();
    }, [activeTab, address, loadChallenges])
  );

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'Clubs') return;
      fetchClubs();
    }, [activeTab, fetchClubs])
  );

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'Clubs' || !address) return;
      fetchJoinedClubs(address);
    }, [activeTab, address, fetchJoinedClubs])
  );

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'Events') return;
      fetchEvents();
    }, [activeTab, fetchEvents])
  );

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'Events' || !address) return;
      fetchJoinedEvents(address);
    }, [activeTab, address, fetchJoinedEvents])
  );

  const onRefresh = useCallback(() => {
    if (activeTab === 'Challenges') {
      setRefreshing(true);
      loadChallenges().finally(() => setRefreshing(false));
    } else if (activeTab === 'Clubs') {
      setRefreshing(true);
      Promise.all([fetchClubs(), address ? fetchJoinedClubs(address) : null]).finally(() =>
        setRefreshing(false)
      );
    } else {
      setRefreshing(true);
      Promise.all([fetchEvents(), address ? fetchJoinedEvents(address) : null]).finally(() =>
        setRefreshing(false)
      );
    }
  }, [
    activeTab,
    loadChallenges,
    fetchClubs,
    fetchJoinedClubs,
    fetchEvents,
    fetchJoinedEvents,
    address,
  ]);

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
    if (!wallet || !address || pendingClubId) return;
    haptics.impactMedium();

    const isJoined = joinedClubIds.includes(club.id);
    setPendingClubId(club.id);
    try {
      await transact(
        () =>
          isJoined
            ? services.group.leaveGroup(wallet, BigInt(club.id))
            : services.group.joinGroup(wallet, BigInt(club.id)),
        {
          pending: isJoined ? 'Leaving club...' : 'Joining club...',
          success: isJoined ? 'Left club' : 'Joined club',
        },
        {
          apply: () => applyClubMembership(club.id, !isJoined),
          revert: () => applyClubMembership(club.id, isJoined),
        }
      );
    } finally {
      setPendingClubId(null);
    }
  };

  const handleJoinEvent = async (eventId: string) => {
    if (!wallet || !address || pendingEventId) return;
    haptics.impactMedium();

    const isJoined = joinedEvents.includes(eventId);
    setPendingEventId(eventId);
    try {
      await transact(
        () =>
          isJoined
            ? services.event.leaveEvent(wallet, BigInt(eventId))
            : services.event.joinEvent(wallet, BigInt(eventId)),
        {
          pending: isJoined ? 'Leaving event...' : 'Joining event...',
          success: isJoined ? 'Left event' : 'Joined event',
        },
        {
          apply: () => applyEventJoin(eventId, !isJoined),
          revert: () => applyEventJoin(eventId, isJoined),
        }
      );
    } finally {
      setPendingEventId(null);
    }
  };

  const renderClub = (item: Club) => {
    const isJoined = joinedClubIds.includes(item.id);
    const isPending = pendingClubId === item.id;
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.card, { backgroundColor: theme.backgroundElement }]}
        onPress={() => router.push(`/club-detail?id=${item.id}`)}
        activeOpacity={0.7}
      >
        <ThemedView style={styles.cardRow}>
          <ThemedView style={[styles.iconCircle, { backgroundColor: theme.brand.primaryTint }]}>
            <Ionicons
              name={SPORT_ICON_NAME(item.sportType)}
              size={22}
              color={theme.brand.primary}
            />
          </ThemedView>
          <ThemedView style={styles.cardInfo}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {item.name}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
              {item.location}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatMemberCount(item.memberCount)} {item.memberCount === 1 ? 'member' : 'members'}
            </ThemedText>
          </ThemedView>
          <TouchableOpacity
            style={[
              styles.joinBtn,
              {
                backgroundColor: isJoined ? 'transparent' : theme.brand.primary,
                borderColor: isJoined ? theme.border : theme.brand.primary,
              },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              handleJoinClub(item);
            }}
            activeOpacity={0.7}
            disabled={isPending || !wallet}
            accessibilityRole="button"
            accessibilityLabel={isJoined ? `Leave ${item.name}` : `Join ${item.name}`}
          >
            {isPending ? (
              <ActivityIndicator
                size="small"
                color={isJoined ? theme.textSecondary : Brand.white}
              />
            ) : (
              <ThemedText
                type="small"
                style={{ color: isJoined ? theme.textSecondary : Brand.white, fontWeight: '600' }}
              >
                {isJoined ? 'Joined' : 'Join'}
              </ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  const renderEvent = (item: ChallengeEvent) => {
    const isJoined = joinedEvents.includes(item.id);
    const isPending = pendingEventId === item.id;
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.card, { backgroundColor: theme.backgroundElement }]}
        onPress={() => router.push(`/event-detail?id=${item.id}`)}
        activeOpacity={0.7}
      >
        <ThemedView style={styles.cardRow}>
          <ThemedView style={[styles.iconCircle, { backgroundColor: theme.brand.primaryTint }]}>
            <Ionicons
              name={SPORT_ICON_NAME(item.sportType)}
              size={22}
              color={theme.brand.primary}
            />
          </ThemedView>
          <ThemedView style={styles.cardInfo}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {item.title}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatDateRange(item.startDate, item.endDate)}
              {item.distanceGoal > 0 ? ` · ${formatDistance(item.distanceGoal)}` : ''}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatMemberCount(item.participantCount)} participants
            </ThemedText>
          </ThemedView>
          <TouchableOpacity
            style={[
              styles.joinBtn,
              {
                backgroundColor: isJoined ? 'transparent' : theme.brand.primary,
                borderColor: isJoined ? theme.border : theme.brand.primary,
              },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              handleJoinEvent(item.id);
            }}
            activeOpacity={0.7}
            disabled={isPending || !wallet}
            accessibilityRole="button"
            accessibilityLabel={isJoined ? `Leave ${item.title}` : `Join ${item.title}`}
          >
            {isPending ? (
              <ActivityIndicator
                size="small"
                color={isJoined ? theme.textSecondary : Brand.white}
              />
            ) : (
              <ThemedText
                type="small"
                style={{ color: isJoined ? theme.textSecondary : Brand.white, fontWeight: '600' }}
              >
                {isJoined ? 'Joined' : 'Join'}
              </ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  const renderChallenge = (
    item: Awaited<ReturnType<typeof services.challenge.getUserChallenges>>[number]
  ) => {
    const currentUserId = address?.toLowerCase();
    const isChallenger = item.challenger.toLowerCase() === currentUserId;
    const opponentAddress = isChallenger ? item.opponent : item.challenger;
    const opponentUser = getUserById(opponentAddress);
    const opponentName = opponentUser
      ? getDisplayName(opponentUser)
      : `${opponentAddress.slice(0, 6)}...${opponentAddress.slice(-4)}`;

    return (
      <TouchableOpacity
        key={item.id.toString()}
        style={[styles.card, { backgroundColor: theme.backgroundElement }]}
        onPress={() => router.push(`/challenge-detail?id=${item.id.toString()}`)}
        activeOpacity={0.7}
      >
        <ThemedView style={styles.cardRow}>
          <ThemedView style={[styles.iconCircle, { backgroundColor: theme.brand.primaryTint }]}>
            <Ionicons name="flag" size={22} color={theme.brand.primary} />
          </ThemedView>
          <ThemedView style={styles.cardInfo}>
            <ThemedText type="smallBold" numberOfLines={1}>
              vs {opponentName}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatActivityDistance(Number(item.targetMetric))} · {formatEther(item.stake)} ETH
              stake
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {CHALLENGE_STATUS_LABEL[item.status] ?? 'Unknown'}
            </ThemedText>
          </ThemedView>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </ThemedView>
      </TouchableOpacity>
    );
  };

  const listData = useMemo<Row[]>(() => {
    if (isClubs) return filteredClubs.map((club) => ({ kind: 'club', club }));
    if (isEvents) return filteredEvents.map((event) => ({ kind: 'event', event }));
    return (challenges ?? []).map((challenge) => ({ kind: 'challenge', challenge }));
  }, [isClubs, isEvents, filteredClubs, filteredEvents, challenges]);

  const keyExtractor = useCallback((item: Row) => {
    if (item.kind === 'club') return item.club.id;
    if (item.kind === 'event') return item.event.id;
    return item.challenge.id.toString();
  }, []);

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'club') return renderClub(item.club);
    if (item.kind === 'event') return renderEvent(item.event);
    return renderChallenge(item.challenge);
  };

  const renderSkeleton = () => (
    <ThemedView style={styles.loadingContainer}>
      <ActivityIndicator size="small" color={theme.brand.primary} />
    </ThemedView>
  );

  const renderEmpty = () => {
    if (isClubs) {
      if (clubsLoading && clubs.length === 0) return renderSkeleton();
      return (
        <ThemedView style={styles.empty}>
          <Ionicons name="people-outline" size={32} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {clubs.length === 0 ? 'No clubs yet. Create the first one!' : 'No clubs found'}
          </ThemedText>
        </ThemedView>
      );
    }
    if (isEvents) {
      if (eventsLoading && events.length === 0) return renderSkeleton();
      return (
        <ThemedView style={styles.empty}>
          <Ionicons name="trophy-outline" size={32} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {services.event.isEventRegistryDeployed()
              ? 'No events yet'
              : "Events aren't live on this network yet"}
          </ThemedText>
        </ThemedView>
      );
    }
    if (challenges === null) return renderSkeleton();
    return (
      <ThemedView style={styles.empty}>
        <Ionicons name="flag-outline" size={32} color={theme.textSecondary} />
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          No challenges yet. Challenge a friend!
        </ThemedText>
      </ThemedView>
    );
  };

  const listHeader = (
    <>
      {/* Header */}
      <ThemedView style={styles.header}>
        <ThemedText type="headline">Groups</ThemedText>
      </ThemedView>

      {/* Sub-Tab Bar */}
      <ThemedView style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabItem,
              activeTab === tab && { borderBottomColor: theme.brand.primary },
            ]}
            onPress={() => handleTabChange(tab)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
          >
            <ThemedText
              type="small"
              style={{
                fontWeight: activeTab === tab ? '700' : '500',
                color: activeTab === tab ? theme.brand.primary : theme.textSecondary,
              }}
            >
              {tab}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ThemedView>

      {/* Search Bar */}
      {(isClubs || isEvents) && (
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={isClubs ? 'Search clubs...' : 'Search events...'}
          style={styles.searchBar}
        />
      )}

      {/* Sport Filter Chips */}
      {isClubs && <FilterChips value={sportFilter} onChange={setSportFilter} />}
      {isEvents && <FilterChips value={eventSportFilter} onChange={setEventSportFilter} />}

      {/* Create buttons */}
      {isClubs && (
        <AppButton
          variant="secondary"
          onPress={() => {
            haptics.tap();
            router.push('/create-club');
          }}
          style={styles.newChallengeBtn}
        >
          + Create Club
        </AppButton>
      )}
      {isEvents && services.event.isEventRegistryDeployed() && (
        <AppButton
          variant="secondary"
          onPress={() => {
            haptics.tap();
            router.push('/create-event');
          }}
          style={styles.newChallengeBtn}
        >
          + Create Event
        </AppButton>
      )}
      {activeTab === 'Challenges' && (
        <AppButton
          variant="secondary"
          onPress={() => {
            haptics.tap();
            router.push('/create-challenge');
          }}
          style={styles.newChallengeBtn}
        >
          + New Challenge
        </AppButton>
      )}
    </>
  );

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
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
            challenges,
            joinedClubIds,
            joinedEvents,
            pendingClubId,
            pendingEventId,
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
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  header: {
    paddingTop: Spacing.two,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.one,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  searchBar: {
    marginTop: Spacing.three,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.three,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  loadingContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  joinBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    minWidth: 72,
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  newChallengeBtn: {
    borderRadius: BorderRadius.full,
  },
});
