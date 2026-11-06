import { services } from '@repo/shared';
import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import { legsToSnap, type RoutePlan, setLeg } from '@/utils/routePlan';

/**
 * Sends every leg that still needs a snap to the routing API and writes the answer back into the
 * plan. A leg that cannot be routed stays a straight line (so the athlete is never blocked) and
 * `onFail` hears why, once per request.
 */
export function useRouteSnapping(
  plan: RoutePlan,
  setPlan: Dispatch<SetStateAction<RoutePlan>>,
  profile: 'foot' | 'bike',
  onFail: (reason: 'no_route' | 'unavailable' | 'not_configured' | 'invalid') => void
) {
  // Requests in flight, keyed by the points they route between, so a re-render never asks twice.
  const pending = useRef(new Set<string>());
  const failRef = useRef(onFail);
  failRef.current = onFail;

  useEffect(() => {
    for (const { index, from, to } of legsToSnap(plan)) {
      const key = `${profile}:${from}:${to}`;
      if (pending.current.has(key)) continue;
      pending.current.add(key);
      void services.routing.snapRoute(profile, [from, to]).then((result) => {
        pending.current.delete(key);
        if (result.ok) {
          setPlan((current) => setLeg(current, index, from, to, result.coordinates));
          return;
        }
        // Draw it straight instead of leaving the leg waiting forever.
        setPlan((current) => setLeg(current, index, from, to, [from, to]));
        failRef.current(result.reason);
      });
    }
  }, [plan, profile, setPlan]);
}
