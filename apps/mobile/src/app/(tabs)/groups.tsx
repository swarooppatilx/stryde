import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther } from 'viem';

import { AppButton } from '@/components/button';
import { FilterChips, type SportFilter } from '@/components/filter-chips';
import { Shimmer } from '@/components/Shimmer/Shimmer';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_ICONS } from '@/constants/activity';
import { ENV } from '@/constants/config';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import type { ChallengeEvent, Club } from '@/data/mock-clubs';
import { useTheme } from '@/hooks/use-theme';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useCommunityStore } from '@/stores/communityStore';
import { useSocialStore } from '@/stores/socialStore';
import type { ActivityType } from '@/types';
import { formatDistance as formatActivityDistance, getDisplayName } from '@/utils/format';
import { haptics } from '@/utils/haptics';

const TABS = ['Clubs', 'Events', 'Challenges'] as const;
type TabKey = (typeof TABS)[number];

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
  const listRef = useRef<ScrollView>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('Clubs');
  const [clubQuery, setClubQuery] = useState('');
  const [eventQuery, setEventQuery] = useState('');
  const [sportFilter, setSportFilter] = useState<SportFilter>('all');
  const [eventSportFilter, setEventSportFilter] = useState<SportFilter>('all');

  const searchClubs = useCommunityStore((s) => s.searchClubs);
  const searchEvents = useCommunityStore((s) => s.searchEvents);
  const toggleJoinClub = useCommunityStore((s) => s.toggleJoinClub);
  const toggleJoinEvent = useCommunityStore((s) => s.toggleJoinEvent);
  const joinedClubs = useCommunityStore((s) => s.joinedClubs);
  const joinedEvents = useCommunityStore((s) => s.joinedEvents);

  const filteredClubs = useMemo(
    () => searchClubs(clubQuery, sportFilter),
    [clubQuery, sportFilter, searchClubs]
  );
  const filteredEvents = useMemo(
    () => searchEvents(eventQuery, eventSportFilter),
    [eventQuery, eventSportFilter, searchEvents]
  );

  const { address } = useViemWallet(ENV.CHAIN_MODE);
  const getUserById = useSocialStore((s) => s.getUserById);
  const [challenges, setChallenges] = useState<Awaited<
    ReturnType<typeof services.challenge.getUserChallenges>
  > | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadChallenges = useCallback(async () => {
    if (!address) return;
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

  const onRefresh = useCallback(() => {
    if (activeTab !== 'Challenges') return;
    setRefreshing(true);
    loadChallenges().finally(() => setRefreshing(false));
  }, [activeTab, loadChallenges]);

  const isClubs = activeTab === 'Clubs';
  const isEvents = activeTab === 'Events';
  const query = isClubs ? clubQuery : eventQuery;
  const setQuery = isClubs ? setClubQuery : setEventQuery;

  const handleTabChange = (tab: TabKey) => {
    haptics.selection();
    setActiveTab(tab);
    listRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleJoinClub = (clubId: string) => {
    haptics.impactMedium();
    toggleJoinClub(clubId);
  };

  const handleJoinEvent = (eventId: string) => {
    haptics.impactMedium();
    toggleJoinEvent(eventId);
  };

  const renderClub = (item: Club) => {
    const isJoined = joinedClubs.includes(item.id);
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
              {formatMemberCount(item.memberCount)} members
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
              handleJoinClub(item.id);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isJoined ? `Leave ${item.name}` : `Join ${item.name}`}
          >
            <ThemedText
              type="small"
              style={{ color: isJoined ? theme.textSecondary : Brand.white, fontWeight: '600' }}
            >
              {isJoined ? 'Joined' : 'Join'}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  const renderEvent = (item: ChallengeEvent) => {
    const isJoined = joinedEvents.includes(item.id);
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
            accessibilityRole="button"
            accessibilityLabel={isJoined ? `Leave ${item.title}` : `Join ${item.title}`}
          >
            <ThemedText
              type="small"
              style={{ color: isJoined ? theme.textSecondary : Brand.white, fontWeight: '600' }}
            >
              {isJoined ? 'Joined' : 'Join'}
            </ThemedText>
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

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          ref={listRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.brand.primary}
            />
          }
        >
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

          {/* Demo vs on-chain data indicator */}
          <ThemedView
            style={[
              styles.dataBadge,
              {
                backgroundColor:
                  activeTab === 'Challenges' ? theme.brand.primaryTint : theme.backgroundElement,
              },
            ]}
          >
            <Ionicons
              name={activeTab === 'Challenges' ? 'link' : 'flask-outline'}
              size={12}
              color={activeTab === 'Challenges' ? theme.brand.primary : theme.textSecondary}
            />
            <ThemedText
              type="caption"
              style={{
                color: activeTab === 'Challenges' ? theme.brand.primary : theme.textSecondary,
              }}
            >
              {activeTab === 'Challenges' ? 'On-chain' : 'Demo data'}
            </ThemedText>
          </ThemedView>

          {/* Search Bar */}
          {(isClubs || isEvents) && (
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={isClubs ? 'Search clubs...' : 'Search events...'}
            />
          )}

          {/* Sport Filter Chips */}
          {isClubs && <FilterChips value={sportFilter} onChange={setSportFilter} />}
          {isEvents && <FilterChips value={eventSportFilter} onChange={setEventSportFilter} />}

          {/* Cards */}
          {isClubs &&
            (filteredClubs.length === 0 ? (
              <ThemedView style={styles.empty}>
                <Ionicons name="people-outline" size={32} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  No clubs found
                </ThemedText>
              </ThemedView>
            ) : (
              filteredClubs.map(renderClub)
            ))}

          {isEvents &&
            (filteredEvents.length === 0 ? (
              <ThemedView style={styles.empty}>
                <Ionicons name="trophy-outline" size={32} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  No events found
                </ThemedText>
              </ThemedView>
            ) : (
              filteredEvents.map(renderEvent)
            ))}

          {activeTab === 'Challenges' && (
            <>
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

              {challenges === null ? (
                <ThemedView style={styles.challengeSkeletonList}>
                  {[0, 1, 2].map((i) => (
                    <ThemedView
                      key={i}
                      style={[styles.card, { backgroundColor: theme.backgroundElement }]}
                    >
                      <ThemedView style={styles.cardRow}>
                        <Shimmer
                          isLoading
                          preset={theme.isDark ? 'dark' : 'light'}
                          style={styles.iconCircle}
                        />
                        <ThemedView style={styles.cardInfo}>
                          <Shimmer
                            isLoading
                            preset={theme.isDark ? 'dark' : 'light'}
                            style={styles.skeletonLine}
                          />
                          <Shimmer
                            isLoading
                            preset={theme.isDark ? 'dark' : 'light'}
                            style={styles.skeletonLineShort}
                          />
                        </ThemedView>
                      </ThemedView>
                    </ThemedView>
                  ))}
                </ThemedView>
              ) : challenges.length === 0 ? (
                <ThemedView style={styles.empty}>
                  <Ionicons name="flag-outline" size={32} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    No challenges yet. Challenge a friend!
                  </ThemedText>
                </ThemedView>
              ) : (
                challenges.map(renderChallenge)
              )}
            </>
          )}
        </ScrollView>
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
  dataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.two,
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
  challengeSkeletonList: {
    gap: Spacing.three,
  },
  skeletonLine: {
    width: '70%',
    height: 14,
    borderRadius: BorderRadius.sm,
  },
  skeletonLineShort: {
    width: '40%',
    height: 12,
    borderRadius: BorderRadius.sm,
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
