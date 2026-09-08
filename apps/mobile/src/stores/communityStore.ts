import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type ChallengeEvent, type Club, MOCK_CLUBS, MOCK_EVENTS } from '@/data/mock-clubs';
import { asyncStorageAdapter, isoDateReviver } from '@/utils/storage';

interface CommunityState {
  clubs: Club[];
  events: ChallengeEvent[];
  joinedClubs: string[];
  joinedEvents: string[];

  toggleJoinClub: (clubId: string) => void;
  toggleJoinEvent: (eventId: string) => void;
  isClubJoined: (clubId: string) => boolean;
  isEventJoined: (eventId: string) => boolean;
  searchClubs: (query: string, sportFilter?: string) => Club[];
  searchEvents: (query: string, sportFilter?: string) => ChallengeEvent[];
  getClubById: (id: string) => Club | undefined;
  getEventById: (id: string) => ChallengeEvent | undefined;
}

export const useCommunityStore = create<CommunityState>()(
  persist(
    (set, get) => ({
      clubs: MOCK_CLUBS,
      events: MOCK_EVENTS,
      joinedClubs: [],
      joinedEvents: [],

      toggleJoinClub: (clubId: string) =>
        set((state) => {
          const isJoined = state.joinedClubs.includes(clubId);
          const updatedJoined = isJoined
            ? state.joinedClubs.filter((id) => id !== clubId)
            : [...state.joinedClubs, clubId];
          const updatedClubs = state.clubs.map((c) =>
            c.id === clubId ? { ...c, memberCount: c.memberCount + (isJoined ? -1 : 1) } : c
          );
          return { joinedClubs: updatedJoined, clubs: updatedClubs };
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

      isClubJoined: (clubId: string) => get().joinedClubs.includes(clubId),
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
    }),
    {
      name: 'stryde-community',
      version: 2,
      storage: createJSONStorage(() => asyncStorageAdapter, { reviver: isoDateReviver }),
      partialize: (state) => ({ joinedClubs: state.joinedClubs, joinedEvents: state.joinedEvents }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) return undefined;
        return persistedState;
      },
    }
  )
);
