import type { ActivityStream } from '@/types';
import { haversineDistance } from './geo';

/**
 * The time the athlete was at each point of a saved route, from the stream kept while recording.
 * Position along the route (as a share of its length) is matched to how far along the athlete was
 * at each moment, so the first point is the start and the last is the finish. Null when the stream
 * predates distance and start time, or the route is too short to place.
 */
export function routeTimes(
  route: readonly [number, number][],
  stream: ActivityStream
): Date[] | null {
  const { t, d, startedAt } = stream;
  if (!d || startedAt === undefined || d.length !== t.length || d.length < 2) return null;
  if (route.length < 2) return null;

  const along: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    const [lng1, lat1] = route[i - 1] as [number, number];
    const [lng2, lat2] = route[i] as [number, number];
    along.push((along[i - 1] as number) + haversineDistance(lat1, lng1, lat2, lng2));
  }
  const routeLength = along.at(-1) as number;
  const covered = d.at(-1) as number;
  if (routeLength <= 0 || covered <= 0) return null;

  // Scale route position onto the measured distance, then find the time at that distance.
  let seg = 0;
  return along.map((metres) => {
    const target = (metres / routeLength) * covered;
    while (seg < d.length - 2 && (d[seg + 1] as number) < target) seg++;
    const d0 = d[seg] as number;
    const d1 = d[seg + 1] as number;
    const t0 = t[seg] as number;
    const t1 = t[seg + 1] as number;
    const share = d1 > d0 ? Math.min(1, Math.max(0, (target - d0) / (d1 - d0))) : 0;
    return new Date(startedAt + (t0 + share * (t1 - t0)) * 1000);
  });
}
