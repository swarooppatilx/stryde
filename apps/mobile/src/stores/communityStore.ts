import { ACTIVITY_TYPE_BY_ID, ACTIVITY_TYPE_MAP, services } from '@repo/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ActivityType } from '@/types';
import type { ChallengeEvent } from '@/types/event';
import { sameAddress } from '@/utils/address';
import { logger } from '@/utils/logger';
import { chainScopedStorageAdapter, isoDateReviver } from '@/utils/storage';

export interface Club {
  id: string;
  name: string;
  location: string;
  description: string;
  sportType: ActivityType | 'multi';
  memberCount: number;
  owner: string;
  createdAt: number;
}

function toClub(group: Awaited<ReturnType<typeof services.group.getAllGroups>>[number]): Club {
  return {
    id: group.id.toString(),
    name: group.name,
    location: group.location,
    description: group.description,
    sportType:
      group.sportType === services.group.MULTI_SPORT_TYPE
        ? 'multi'
        : (ACTIVITY_TYPE_BY_ID[group.sportType] ?? 'run'),
    memberCount: group.memberCount,
    owner: group.owner,
    createdAt: group.createdAt,
  };
}

/** Maps an onchain StrydeEvent to the app's ChallengeEvent shape (startDate/endDate as Dates). */
function toChallengeEvent(
  event: Awaited<ReturnType<typeof services.event.getAllEvents>>[number]
): ChallengeEvent {
  return {
    id: event.id.toString(),
    title: event.title,
    startDate: new Date(event.startTime * 1000),
    endDate: new Date(event.endTime * 1000),
    distanceGoal: event.distanceGoal,
    participantCount: event.participantCount,
    sportType:
      event.sportType === services.event.MULTI_SPORT_TYPE
        ? 'multi'
        : (ACTIVITY_TYPE_BY_ID[event.sportType] ?? 'run'),
    description: event.description,
    host: event.host,
  };
}

interface CommunityState {
  clubs: Club[];
  clubsLoading: boolean;
  /** Why the last clubs refresh failed; null when it worked. The list itself is left as it was. */
  clubsError: string | null;
  /** Ids of clubs the connected wallet belongs to; separate from `clubs` because membership is per-wallet. */
  joinedClubIds: string[];

  events: ChallengeEvent[];
  eventsLoading: boolean;
  eventsError: string | null;
  joinedEvents: string[];

  fetchClubs: () => Promise<void>;
  fetchJoinedClubs: (wallet: `0x${string}`) => Promise<void>;
  /** Applies a join/leave locally once the tx confirms, without waiting for a `fetchClubs()` round-trip. */
  applyClubMembership: (clubId: string, joined: boolean) => void;
  upsertClub: (club: Club) => void;

  fetchEvents: () => Promise<void>;
  fetchJoinedEvents: (wallet: `0x${string}`) => Promise<void>;
  /** Applies a join/leave locally once the tx confirms. */
  applyEventJoin: (eventId: string, joined: boolean) => void;
  upsertEvent: (event: ChallengeEvent) => void;
  removeEvent: (eventId: string) => void;

  isClubJoined: (clubId: string) => boolean;
  isEventJoined: (eventId: string) => boolean;
  isEventHost: (eventId: string, wallet?: `0x${string}`) => boolean;
  reset: () => void;
}

const matchesSport = (sportType: string, filter?: string) =>
  !filter || filter === 'all' || sportType === filter;

/** Clubs whose name, location or description contains `query`, in one sport (or all). */
export function filterClubs(clubs: readonly Club[], query: string, sportFilter?: string): Club[] {
  const q = query.toLowerCase();
  return clubs.filter(
    (c) =>
      (!q ||
        c.name.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)) &&
      matchesSport(c.sportType, sportFilter)
  );
}

/** Clubs as the list shows them: the ones you are in first, then the rest with the most members first. */
export function orderClubs(clubs: readonly Club[], joinedIds: readonly string[]): Club[] {
  const joined = new Set(joinedIds);
  return [...clubs].sort(
    (a, b) =>
      Number(joined.has(b.id)) - Number(joined.has(a.id)) ||
      b.memberCount - a.memberCount ||
      a.name.localeCompare(b.name)
  );
}

/** Events whose title or description contains `query`, in one sport (or all). */
export function filterEvents(
  events: readonly ChallengeEvent[],
  query: string,
  sportFilter?: string
): ChallengeEvent[] {
  const q = query.toLowerCase();
  return events.filter(
    (e) =>
      (!q || e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)) &&
      matchesSport(e.sportType, sportFilter)
  );
}

const INITIAL_STATE = {
  clubs: [] as Club[],
  clubsLoading: false,
  clubsError: null as string | null,
  joinedClubIds: [] as string[],
  events: [] as ChallengeEvent[],
  eventsLoading: false,
  eventsError: null as string | null,
  joinedEvents: [] as string[],
};

export const useCommunityStore = create<CommunityState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      fetchClubs: async () => {
        set({ clubsLoading: true });
        try {
          const groups = await services.group.getAllGroups();
          set({ clubs: groups.map(toClub), clubsError: null });
        } catch (e) {
          // Keep what is already loaded: a failed read is not "there are no clubs".
          logger.warn('[Community] Failed to fetch clubs:', e);
          set({ clubsError: e instanceof Error ? e.message : 'Could not load clubs' });
        } finally {
          set({ clubsLoading: false });
        }
      },

      fetchJoinedClubs: async (wallet: `0x${string}`) => {
        try {
          const groups = await services.group.getUserGroups(wallet);
          set({ joinedClubIds: groups.map((g) => g.id.toString()) });
        } catch (e) {
          logger.warn('[Community] Failed to fetch joined clubs:', e);
        }
      },

      applyClubMembership: (clubId: string, joined: boolean) =>
        set((state) => {
          const isJoined = state.joinedClubIds.includes(clubId);
          if (isJoined === joined) return state;

          const joinedClubIds = joined
            ? [...state.joinedClubIds, clubId]
            : state.joinedClubIds.filter((id) => id !== clubId);

          const clubs = state.clubs.map((c) =>
            c.id === clubId
              ? { ...c, memberCount: Math.max(0, c.memberCount + (joined ? 1 : -1)) }
              : c
          );

          return { joinedClubIds, clubs };
        }),

      upsertClub: (club: Club) =>
        set((state) => {
          const exists = state.clubs.some((c) => c.id === club.id);
          return {
            clubs: exists
              ? state.clubs.map((c) => (c.id === club.id ? club : c))
              : [club, ...state.clubs],
          };
        }),

      fetchEvents: async () => {
        set({ eventsLoading: true });
        try {
          const events = await services.event.getAllEvents();
          set({ events: events.map(toChallengeEvent), eventsError: null });
        } catch (e) {
          logger.warn('[Community] Failed to fetch events:', e);
          set({ eventsError: e instanceof Error ? e.message : 'Could not load events' });
        } finally {
          set({ eventsLoading: false });
        }
      },

      fetchJoinedEvents: async (wallet: `0x${string}`) => {
        if (!services.event.isEventRegistryDeployed()) return;
        try {
          const userEvents = await services.event.getUserEvents(wallet);
          set({ joinedEvents: userEvents.map((e) => e.id.toString()) });
        } catch (e) {
          logger.warn('[Community] Failed to fetch joined events:', e);
        }
      },

      applyEventJoin: (eventId: string, joined: boolean) =>
        set((state) => {
          const isJoined = state.joinedEvents.includes(eventId);
          if (isJoined === joined) return state;

          const joinedEvents = joined
            ? [...state.joinedEvents, eventId]
            : state.joinedEvents.filter((id) => id !== eventId);

          const events = state.events.map((e) =>
            e.id === eventId
              ? { ...e, participantCount: Math.max(0, e.participantCount + (joined ? 1 : -1)) }
              : e
          );

          return { joinedEvents, events };
        }),

      upsertEvent: (event: ChallengeEvent) =>
        set((state) => {
          const exists = state.events.some((e) => e.id === event.id);
          return {
            events: exists
              ? state.events.map((e) => (e.id === event.id ? event : e))
              : [event, ...state.events],
          };
        }),

      removeEvent: (eventId: string) =>
        set((state) => ({ events: state.events.filter((e) => e.id !== eventId) })),

      isClubJoined: (clubId: string) => get().joinedClubIds.includes(clubId),
      isEventJoined: (eventId: string) => get().joinedEvents.includes(eventId),
      isEventHost: (eventId: string, wallet?: `0x${string}`) => {
        const event = get().events.find((e) => e.id === eventId);
        return sameAddress(event?.host, wallet);
      },

      reset: () => set({ ...INITIAL_STATE }),
    }),
    {
      name: 'stryde-community',
      version: 4,
      storage: createJSONStorage(() => chainScopedStorageAdapter, { reviver: isoDateReviver }),
      partialize: (state) => ({ joinedEvents: state.joinedEvents }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 4) {
          const state = persistedState as Record<string, unknown>;
          return {
            joinedEvents: (state.joinedEvents as string[]) ?? [],
          };
        }
        return persistedState;
      },
    }
  )
);

/** sportType to send to GroupRegistry.createGroup() for a single activity type; multi-sport groups would use MULTI_SPORT_TYPE. */
export function sportTypeToOnchain(sportType: ActivityType): number {
  return ACTIVITY_TYPE_MAP[sportType];
}
