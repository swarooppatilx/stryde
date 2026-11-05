import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getPlatform } from '@/platform';
import type { ActivityType } from '@/types';
import { chainScopedStorageAdapter } from '@/utils/storage';

export interface SavedRoute {
  id: string;
  name: string;
  /** The line, as the activities store it ("lng,lat;lng,lat"). */
  polyline: string;
  /** Metres. */
  distance: number;
  /** Total climb in metres, when it was known at save time; routes saved before this existed have none. */
  elevationGain?: number;
  /** Seconds: how long the activity it came from took. Drawn routes have none. */
  duration?: number;
  sport: ActivityType;
  savedAt: number;
  starred?: boolean;
}

interface RouteState {
  /** Newest first. */
  routes: SavedRoute[];
  /** Saves a route; a line that is already saved is returned as it is, not added twice. */
  save: (input: {
    name: string;
    polyline: string;
    distance: number;
    sport: ActivityType;
    elevationGain?: number;
    duration?: number;
  }) => SavedRoute;
  remove: (id: string) => void;
  /** Renames a route; an empty name is ignored. */
  rename: (id: string, name: string) => void;
  toggleStar: (id: string) => void;
  isSaved: (polyline: string) => boolean;
  reset: () => void;
}

/** Routes the athlete wants to find again on the Map tab; kept on this device only. */
export const useRouteStore = create<RouteState>()(
  persist(
    (set, get) => ({
      routes: [],
      save: ({ name, polyline, distance, sport, elevationGain, duration }) => {
        const existing = get().routes.find((r) => r.polyline === polyline);
        if (existing) return existing;
        const platform = getPlatform();
        const route: SavedRoute = {
          id: platform.ids.next(),
          name: name.trim(),
          polyline,
          distance,
          sport,
          savedAt: platform.clock.now(),
          ...(elevationGain === undefined ? {} : { elevationGain }),
          ...(duration === undefined ? {} : { duration }),
        };
        set((s) => ({ routes: [route, ...s.routes] }));
        return route;
      },
      remove: (id) => set((s) => ({ routes: s.routes.filter((r) => r.id !== id) })),
      rename: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({ routes: s.routes.map((r) => (r.id === id ? { ...r, name: trimmed } : r)) }));
      },
      toggleStar: (id) =>
        set((s) => ({
          routes: s.routes.map((r) => (r.id === id ? { ...r, starred: !r.starred } : r)),
        })),
      isSaved: (polyline) => get().routes.some((r) => r.polyline === polyline),
      reset: () => set({ routes: [] }),
    }),
    {
      name: '@stryde/routes',
      version: 1,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);
