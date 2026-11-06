import { useMemo, useRef, useState } from 'react';
import { getPlatform } from '@/platform';
import { useFollowRouteStore } from '@/stores/followRouteStore';
import type { Location } from '@/types';
import { stepFollowAlert } from '@/utils/followAlert';
import { haptics } from '@/utils/haptics';
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
    const position: [number, number] = [fix?.longitude ?? 0, fix?.latitude ?? 0];
    const progress = fix
      ? routeProgress(position, route.line, cumulative, lastAlong.current)
      : null;
    const step = fix
      ? stepFollowAlert(
          { off: state.off, lastAlongM: lastAlong.current },
          position,
          route.line,
          cumulative
        )
      : { state: { off: state.off, lastAlongM: lastAlong.current }, alert: null };
    lastAlong.current = step.state.lastAlongM;
    if (recording && step.alert === 'off') {
      haptics.warning();
      getPlatform().speaker.speak('Off route');
    } else if (recording && step.alert === 'back') {
      haptics.success();
      getPlatform().speaker.speak('Back on route');
    }
    setState({ fix, progress, off: step.state.off });
  }

  if (!route) return null;
  return { name: route.name, progress: state.progress, offRoute: state.off };
}
