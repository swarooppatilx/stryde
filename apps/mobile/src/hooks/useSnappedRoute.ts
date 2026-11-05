import { useEffect, useRef, useState } from 'react';
import { ENV } from '@/constants/config';
import { type DirectionsProfile, fetchSnappedLine } from '@/services/directions';
import type { RoutePoint } from '@/utils/route';
import { waypointsDistance } from '@/utils/routeBuilder';

export type SnapStatus = 'straight' | 'loading' | 'snapped' | 'failed';

export interface SnappedRoute {
  /** The line to draw and save: along the paths when snapped, straight between points otherwise. */
  line: RoutePoint[];
  distance: number;
  status: SnapStatus;
}

const DEBOUNCE_MS = 350;

/**
 * Routes the waypoints along real paths while snapping is on. While a request is out the last
 * snapped line stays up; when it fails the straight line stands in and `status` says so.
 */
export function useSnappedRoute(
  points: readonly RoutePoint[],
  profile: DirectionsProfile,
  snap: boolean
): SnappedRoute {
  const key = `${profile}|${points.map((p) => p.join(',')).join(';')}`;
  const cache = useRef(new Map<string, { line: RoutePoint[]; distance: number }>());
  const [result, setResult] = useState<{
    key: string;
    line: RoutePoint[];
    distance: number;
  } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const wanted = snap && points.length >= 2 && !!ENV.MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    if (!wanted) return;
    const cached = cache.current.get(key);
    if (cached) {
      setResult({ key, ...cached });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchSnappedLine(points, profile, {
        token: ENV.MAPBOX_ACCESS_TOKEN,
        signal: controller.signal,
      })
        .then((snapped) => {
          if (controller.signal.aborted) return;
          if (!snapped) {
            setFailedKey(key);
            return;
          }
          const routed = { line: snapped.coordinates, distance: snapped.distance };
          cache.current.set(key, routed);
          setResult({ key, ...routed });
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailedKey(key);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `key` stands for the points and profile.
    // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the waypoint string, not the array identity
  }, [key, wanted]);

  const straight = { line: [...points], distance: waypointsDistance(points) };
  if (!wanted) return { ...straight, status: 'straight' };
  if (result?.key === key)
    return { line: result.line, distance: result.distance, status: 'snapped' };
  if (failedKey === key) return { ...straight, status: 'failed' };
  return result
    ? { line: result.line, distance: result.distance, status: 'loading' }
    : { ...straight, status: 'loading' };
}
