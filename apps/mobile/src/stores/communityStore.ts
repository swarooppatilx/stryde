import { ACTIVITY_TYPE_BY_ID, ACTIVITY_TYPE_MAP, services } from '@repo/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type ChallengeEvent, MOCK_EVENTS } from '@/data/mock-clubs';
import type { ActivityType } from '@/types';
import { asyncStorageAdapter, isoDateReviver } from '@/utils/storage';

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

interface CommunityState {
  clubs: Club[];
  clubsLoading: boolean;
  /** Ids of clubs the currently-connected wallet belongs to, refreshed by
   * fetchJoinedClubs(). Kept separate from `clubs` (which is the same list
   * for every viewer) since membership is per-wallet. */
  joinedClubIds: string[];

  events: ChallengeEvent[];
  joinedEvents: string[];

  fetchClubs: () => Promise<void>;
  fetchJoinedClubs: (wallet: `0x${string}`) => Promise<void>;
  /** Optimistic local update after a joinGroup/leaveGroup tx confirms, so the
   * UI doesn't have to wait on a full fetchClubs() round-trip to reflect it. */
  applyClubMembership: (clubId: string, joined: boolean) => void;
  upsertClub: (club: Club) => void;

  toggleJoinEvent: (eventId: string) => void;
  isClubJoined: (clubId: string) => boolean;
  isEventJoined: (eventId: string) => boolean;
  searchClubs: (query: string, sportFilter?: string) => Club[];
  searchEvents: (query: string, sportFilter?: string) => ChallengeEvent[];
  getClubById: (id: string) => Club | undefined;
  getEventById: (id: string) => ChallengeEvent | undefined;
  reset: () => void;
}

const INITIAL_STATE = {
  clubs: [] as Club[],
  clubsLoading: false,
  joinedClubIds: [] as string[],
  events: MOCK_EVENTS,
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
          set({ clubs: groups.map(toClub) });
        } catch (e) {
          console.warn('[Community] Failed to fetch clubs:', e);
        } finally {
          set({ clubsLoading: false });
        }
      },

      fetchJoinedClubs: async (wallet: `0x${string}`) => {
        try {
          const groups = await services.group.getUserGroups(wallet);
          set({ joinedClubIds: groups.map((g) => g.id.toString()) });
        } catch (e) {
          console.warn('[Community] Failed to fetch joined clubs:', e);
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

      toggleJoinEvent: (eventId: string) =>
        set((state) => {
          const isJoined = state.joinedEvents.includes(eventId);
          const updatedJoined = isJoined
            ? state.joinedEvents.filter((id) => id !== eventId)
            : [...state.joinedEvents, eventId];
          const updatedEvents = state.events.map((e) =>
            e.id === eventId
              ? { ...e, participantCount: e.participantCount + (isJoined ? -1 : 1) }
              : e
          );
          return { joinedEvents: updatedJoined, events: updatedEvents };
        }),

      isClubJoined: (clubId: string) => get().joinedClubIds.includes(clubId),
      isEventJoined: (eventId: string) => get().joinedEvents.includes(eventId),

      searchClubs: (query: string, sportFilter?: string) => {
        const { clubs } = get();
        const q = query.toLowerCase();
        return clubs.filter((c) => {
          const matchesQuery =
            !q || c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q);
          const matchesSport = !sportFilter || sportFilter === 'all' || c.sportType === sportFilter;
          return matchesQuery && matchesSport;
        });
      },

      searchEvents: (query: string, sportFilter?: string) => {
        const { events } = get();
        const q = query.toLowerCase();
        return events.filter((e) => {
          const matchesQuery = !q || e.title.toLowerCase().includes(q);
          const matchesSport = !sportFilter || sportFilter === 'all' || e.sportType === sportFilter;
          return matchesQuery && matchesSport;
        });
      },

      getClubById: (id: string) => get().clubs.find((c) => c.id === id),
      getEventById: (id: string) => get().events.find((e) => e.id === id),

      reset: () => set({ ...INITIAL_STATE }),
    }),
    {
      name: 'stryde-community',
      version: 3,
      storage: createJSONStorage(() => asyncStorageAdapter, { reviver: isoDateReviver }),
      partialize: (state) => ({ joinedEvents: state.joinedEvents }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 3) {
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

/** sportType value to send to GroupRegistry.createGroup() for a single
 * activity type. Multi-sport creation isn't exposed in the UI yet — see
 * MULTI_SPORT_TYPE above for the sentinel a group would use if it were. */
export function sportTypeToOnchain(sportType: ActivityType): number {
  return ACTIVITY_TYPE_MAP[sportType];
}
