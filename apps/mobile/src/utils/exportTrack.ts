import type { Activity, ActivityType, Lap } from '@/types';
import { haversineDistance } from '@/utils/geo';
import type { TrackPoint } from '@/utils/importTrack';

export interface ExportPoint extends TrackPoint {
  /** Metres from the start, along the route. */
  distance: number;
}

/** What the FIT and TCX writers need: the route with its measured series lined up point by point. */
export interface ExportTrack {
  name: string;
  sport: ActivityType;
  startedAt: number;
  totalDistanceM: number;
  totalTimeMs: number;
  points: ExportPoint[];
  laps?: Lap[];
}

type Source = Pick<
  Activity,
  'name' | 'activityType' | 'distance' | 'duration' | 'stream' | 'laps' | 'createdAt'
>;

/** The reading in force at `seconds`: the last sample at or before it, or the first when it is earlier than all. */
function valueAt(
  t: readonly number[],
  values: readonly number[],
  seconds: number
): number | undefined {
  if (t.length === 0 || t.length !== values.length) return undefined;
  let low = 0;
  let high = t.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((t[mid] as number) <= seconds) low = mid;
    else high = mid - 1;
  }
  return values[low];
}

/**
 * Lines the recording's series up with the saved route. The route is thinned, so a point's time is
 * its share of the distance applied to the recorded time; a stream without a start time spreads
 * the points evenly over the activity's moving time. Null when there is no line to export.
 */
export function buildExportTrack(
  activity: Source,
  route: readonly [number, number][],
  elevations?: readonly number[]
): ExportTrack | null {
  if (route.length < 2) return null;

  const along: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    const [lng1, lat1] = route[i - 1] as [number, number];
    const [lng2, lat2] = route[i] as [number, number];
    along.push((along[i - 1] as number) + haversineDistance(lat1, lng1, lat2, lng2));
  }
  const routeLength = along.at(-1) as number;
  const totalDistanceM = activity.distance > 0 ? activity.distance : routeLength;
  const totalTimeMs = Math.max(0, activity.duration);
  const startedAt = activity.stream?.startedAt ?? activity.createdAt.getTime() - totalTimeMs;
  const stream = activity.stream;
  const aligned = elevations?.length === route.length ? elevations : undefined;

  const points = route.map<ExportPoint>(([longitude, latitude], i) => {
    const share = routeLength > 0 ? (along[i] as number) / routeLength : i / (route.length - 1);
    const seconds = (totalTimeMs / 1000) * share;
    const point: ExportPoint = {
      latitude,
      longitude,
      timestamp: Math.round(startedAt + seconds * 1000),
      distance: Math.round(totalDistanceM * share),
    };
    const altitude = aligned?.[i];
    if (altitude !== undefined && Number.isFinite(altitude)) point.altitude = altitude;
    if (stream?.heartRate) {
      const bpm = valueAt(stream.heartRate.t, stream.heartRate.bpm, seconds);
      if (bpm !== undefined && bpm > 0) point.heartRate = Math.round(bpm);
    }
    if (stream?.cadence) {
      const spm = valueAt(stream.cadence.t, stream.cadence.spm, seconds);
      if (spm !== undefined && spm > 0) point.cadence = Math.round(spm);
    }
    return point;
  });

  return {
    name: activity.name || 'Activity',
    sport: activity.activityType,
    startedAt,
    totalDistanceM,
    totalTimeMs,
    points,
    ...(activity.laps && activity.laps.length > 0 && { laps: activity.laps }),
  };
}
