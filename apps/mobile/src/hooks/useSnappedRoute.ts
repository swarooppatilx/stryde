import { useEffect, useRef, useState } from 'react';
import { ENV } from '@/constants/config';
import { type DirectionsProfile, fetchSnappedRoute, type SnapFailure } from '@/services/directions';
import type { RoutePoint } from '@/utils/route';
import { waypointsDistance } from '@/utils/routeBuilder';

export type SnapStatus = 'straight' | 'loading' | 'snapped' | 'failed';

export interface SnappedRoute {
  /** The line to draw and save: along the paths when snapped, straight between points otherwise. */
  line: RoutePoint[];
  distance: number;
  status: SnapStatus;
  /** Why the paths could not be followed, when `status` is 'failed'. */
  failure?: SnapFailure;
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
  const [failed, setFailed] = useState<{ key: string; reason: SnapFailure } | null>(null);
  const latest = useRef({ points, profile });
  latest.current = { points, profile };
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
      const { points, profile } = latest.current;
      fetchSnappedRoute(points, profile, {
        token: ENV.MAPBOX_ACCESS_TOKEN,
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (!result.ok) {
            setFailed({ key, reason: result.reason });
            return;
          }
          const routed = { line: result.line.coordinates, distance: result.line.distance };
          cache.current.set(key, routed);
          setResult({ key, ...routed });
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailed({ key, reason: 'unknown' });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `key` stands for the points and profile, which are read from a ref.
  }, [key, wanted]);

  const straight = { line: [...points], distance: waypointsDistance(points) };
  if (!wanted) return { ...straight, status: 'straight' };
  if (result?.key === key)
    return { line: result.line, distance: result.distance, status: 'snapped' };
  if (failed?.key === key) return { ...straight, status: 'failed', failure: failed.reason };
  return result
    ? { line: result.line, distance: result.distance, status: 'loading' }
    : { ...straight, status: 'loading' };
}
