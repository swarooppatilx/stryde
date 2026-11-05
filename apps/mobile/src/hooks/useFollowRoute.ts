import { useMemo, useRef, useState } from 'react';
import { getPlatform } from '@/platform';
import { useFollowRouteStore } from '@/stores/followRouteStore';
import type { Location } from '@/types';
import { haptics } from '@/utils/haptics';
import { stepOffRoute } from '@/utils/offRoute';
import { cumulativeLengths, type RouteProgress, routeProgress } from '@/utils/routeProgress';

export interface FollowRouteView {
  name: string;
  progress: RouteProgress | null;
  offRoute: boolean;
}

/**
 * Progress along the route being followed, from the latest fix. Leaving the route (or coming back
 * to it) while recording buzzes and is said aloud once, not on every fix.
 */
export function useFollowRoute(fix: Location | null, recording: boolean): FollowRouteView | null {
  const route = useFollowRouteStore((s) => s.route);
  const cumulative = useMemo(() => (route ? cumulativeLengths(route.line) : []), [route]);
  const lastAlong = useRef(0);
  const [state, setState] = useState<{
    fix: Location | null;
    progress: RouteProgress | null;
    off: boolean;
  }>({
    fix: null,
    progress: null,
    off: false,
  });

  // Recomputed once per fix, during render, so the banner and the alert see the same numbers.
  if (route && fix !== state.fix) {
    const progress = fix
      ? routeProgress([fix.longitude, fix.latitude], route.line, cumulative, lastAlong.current)
      : null;
    if (progress) lastAlong.current = Math.max(lastAlong.current, progress.alongM);
    const off = progress ? stepOffRoute({ off: state.off }, progress.offsetM).off : state.off;
    if (recording && off !== state.off) {
      if (off) {
        haptics.warning();
        getPlatform().speaker.speak('Off route');
      } else {
        haptics.success();
        getPlatform().speaker.speak('Back on route');
      }
    }
    setState({ fix, progress, off });
  }

  if (!route) return null;
  return { name: route.name, progress: state.progress, offRoute: state.off };
}
