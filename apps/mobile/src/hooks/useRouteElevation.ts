import { useEffect, useState } from 'react';
import { getElevationForRoute } from '@/services/elevationService';
import type { RoutePoint } from '@/utils/route';

export type RouteElevation =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; elevations: number[] };

/** Ground height along a line from the elevation lookup, waiting `delayMs` after the line stops changing. */
export function useRouteElevation(line: RoutePoint[], delayMs = 0): RouteElevation {
  const [state, setState] = useState<RouteElevation>({ status: 'idle' });

  useEffect(() => {
    if (line.length < 2) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    const timer = setTimeout(() => {
      getElevationForRoute(line)
        .then((data) => {
          if (cancelled) return;
          setState(
            data && data.elevations.length >= 2
              ? { status: 'ready', elevations: data.elevations }
              : { status: 'unavailable' }
          );
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'unavailable' });
        });
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [line, delayMs]);

  return state;
}
