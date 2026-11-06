import { stepOffRoute } from '@/utils/offRoute';
import type { RoutePoint } from '@/utils/route';
import { cumulativeLengths, routeProgress } from '@/utils/routeProgress';

/** Storage keys shared by the app and the background location task (which can't see app state). */
export const FOLLOW_ROUTE_KEY = '@stryde/follow-route';
export const FOLLOW_ROUTE_STATE_KEY = '@stryde/follow-route-state';

export interface StoredFollowRoute {
  name: string;
  line: RoutePoint[];
}

export interface FollowAlertState {
  off: boolean;
  /** Furthest point reached along the route, so a loop doesn't snap back to its start. */
  lastAlongM: number;
}

export const FRESH_FOLLOW_STATE: FollowAlertState = { off: false, lastAlongM: 0 };

/** The next state for a new position, and whether the athlete just left or rejoined the route. */
export function stepFollowAlert(
  state: FollowAlertState,
  position: RoutePoint,
  line: readonly RoutePoint[],
  cumulative: readonly number[] = cumulativeLengths(line)
): { state: FollowAlertState; alert: 'off' | 'back' | null } {
  const progress = routeProgress(position, line, cumulative, state.lastAlongM);
  if (!progress) return { state, alert: null };
  const off = stepOffRoute({ off: state.off }, progress.offsetM).off;
  const next = { off, lastAlongM: Math.max(state.lastAlongM, progress.alongM) };
  if (off === state.off) return { state: next, alert: null };
  return { state: next, alert: off ? 'off' : 'back' };
}

/** What the notification says. */
export function followAlertText(
  alert: 'off' | 'back',
  routeName: string
): { title: string; body: string } {
  return alert === 'off'
    ? { title: 'Off route', body: `You've left ${routeName}. Open the map to get back on it.` }
    : { title: 'Back on route', body: `You're back on ${routeName}.` };
}
