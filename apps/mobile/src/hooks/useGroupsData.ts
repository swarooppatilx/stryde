import { services } from '@repo/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCommunityStore } from '@/stores/communityStore';
import { logger } from '@/utils/logger';
import { isStale } from '@/utils/staleness';

export type GroupsTab = 'Challenges' | 'Clubs' | 'Events';
export type UserChallenge = Awaited<
  ReturnType<typeof services.challenge.getUserChallenges>
>[number];

/** How long a Groups list counts as fresh when the tab regains focus. */
const FOCUS_REFRESH_MS = 30_000;

type ListName = 'challenges' | 'clubs' | 'events';

/**
 * Loads what the Groups tabs show: the athlete's challenges (kept here) and the clubs and events
 * (kept in the community store). Opening the tab refreshes a list that has gone stale, and
 * `onRefresh` reloads the active one on demand.
 */
export function useGroupsData({
  activeTab,
  address,
  noChain,
}: {
  activeTab: GroupsTab;
  address: `0x${string}` | null;
  /** A profile with no chain cannot read challenges, and a retry would fail the same way. */
  noChain: boolean;
}) {
  const fetchClubs = useCommunityStore((s) => s.fetchClubs);
  const fetchJoinedClubs = useCommunityStore((s) => s.fetchJoinedClubs);
  const fetchEvents = useCommunityStore((s) => s.fetchEvents);
  const fetchJoinedEvents = useCommunityStore((s) => s.fetchJoinedEvents);

  const [challenges, setChallenges] = useState<UserChallenge[] | null>(null);
  const [challengesError, setChallengesError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
  const loadedAt = useRef<Record<ListName, number | null>>({
    challenges: null,
    clubs: null,
    events: null,
  });
  const dueFor = useCallback((list: ListName) => {
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
    setRefreshing(true);
    let reload: Promise<unknown>;
    if (activeTab === 'Challenges') reload = loadChallenges();
    else if (activeTab === 'Clubs') {
      reload = Promise.all([fetchClubs(), address ? fetchJoinedClubs(address) : null]);
    } else {
      reload = Promise.all([fetchEvents(), address ? fetchJoinedEvents(address) : null]);
    }
    void reload.finally(() => setRefreshing(false));
  };

  return { challenges, challengesError, refreshing, onRefresh };
}
