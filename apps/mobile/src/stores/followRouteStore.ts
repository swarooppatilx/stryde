import { create } from 'zustand';
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

/** The route chosen with "Use this route"; kept while the app runs so switching tabs keeps it. */
export const useFollowRouteStore = create<FollowRouteState>()((set) => ({
  route: null,
  follow: (route) => set({ route }),
  stop: () => set({ route: null }),
}));
