import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chainScopedStorageAdapter } from '@/utils/storage';

/** What is kept of a starred segment, so the list and the map can show it with no network. */
export interface StarredSegment {
  key: string;
  name: string;
  sportType: number;
  start: { latitude: number; longitude: number };
  end: { latitude: number; longitude: number };
  distanceM: number;
}

interface SegmentStarsState {
  starred: Record<string, StarredSegment>;
  /** Stars a segment, or removes the star when it already has one. */
  toggle: (segment: StarredSegment) => void;
  unstar: (key: string) => void;
  reset: () => void;
}

const keep = (s: StarredSegment): StarredSegment => ({
  key: s.key,
  name: s.name,
  sportType: s.sportType,
  start: { latitude: s.start.latitude, longitude: s.start.longitude },
  end: { latitude: s.end.latitude, longitude: s.end.longitude },
  distanceM: s.distanceM,
});

/** The segments the athlete starred, on this device only (nothing is sent anywhere). */
export const useSegmentStarsStore = create<SegmentStarsState>()(
  persist(
    (set) => ({
      starred: {},
      toggle: (segment) =>
        set((s) => {
          if (s.starred[segment.key]) {
            const { [segment.key]: _removed, ...rest } = s.starred;
            return { starred: rest };
          }
          return { starred: { ...s.starred, [segment.key]: keep(segment) } };
        }),
      unstar: (key) =>
        set((s) => {
          if (!s.starred[key]) return s;
          const { [key]: _removed, ...rest } = s.starred;
          return { starred: rest };
        }),
      reset: () => set({ starred: {} }),
    }),
    {
      name: '@stryde/segment-stars',
      version: 1,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);

export const isStarred = (starred: Record<string, StarredSegment>, key: string) =>
  Boolean(starred[key]);

/** Starred segments, newest star last as they were added. */
export const starredList = (starred: Record<string, StarredSegment>): StarredSegment[] =>
  Object.values(starred);
