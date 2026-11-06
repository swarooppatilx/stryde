import { create } from 'zustand';
import { platformStorage } from '@/platform/storage';
import {
  FOLLOW_ROUTE_KEY,
  FOLLOW_ROUTE_STATE_KEY,
  type StoredFollowRoute,
} from '@/utils/followAlert';
import { logger } from '@/utils/logger';
import type { RoutePoint } from '@/utils/route';

export interface FollowedRoute {
  id: string;
  name: string;
  line: RoutePoint[];
}

interface FollowRouteState {
  /** The saved route the Record map is guiding the athlete along, if any. */
  route: FollowedRoute | null;
  follow: (route: FollowedRoute) => void;
  stop: () => void;
}

/** The background location task runs apart from the app's state, so it reads the route from storage. */
function persist(route: FollowedRoute | null): void {
  const write = route
    ? Promise.all([
        platformStorage.setItem(
          FOLLOW_ROUTE_KEY,
          JSON.stringify({ name: route.name, line: route.line } satisfies StoredFollowRoute)
        ),
        platformStorage.removeItem(FOLLOW_ROUTE_STATE_KEY),
      ])
    : Promise.all([
        platformStorage.removeItem(FOLLOW_ROUTE_KEY),
        platformStorage.removeItem(FOLLOW_ROUTE_STATE_KEY),
      ]);
  write.catch((error: unknown) => logger.warn('[FollowRoute] Could not save the route', error));
}

/** The route chosen with "Use this route"; kept while the app runs so switching tabs keeps it. */
export const useFollowRouteStore = create<FollowRouteState>()((set) => ({
  route: null,
  follow: (route) => {
    set({ route });
    persist(route);
  },
  stop: () => {
    set({ route: null });
    persist(null);
  },
}));
