import { MAX_SPEED_KMH } from '@/constants/activity';
import type { ActivityStream, ActivityType, Location } from '@/types';
import { alignedAltitudes } from './elevation';
import { haversineDistance } from './geo';

/** A recording is thinned to this many points: enough for a smooth curve, small enough to store. */
export const MAX_STREAM_POINTS = 240;
/** Speed is measured over about this long, so one noisy fix doesn't spike the curve. */
const WINDOW_MS = 15_000;

/** Drops impossible GPS speeds from the pace chart. */
export function plausibleStreamSpeeds(
  speed: readonly number[],
  activityType: ActivityType
): number[] {
  const maximum = MAX_SPEED_KMH[activityType] / 3.6;
  return speed.map((value) =>
    Number.isFinite(value) && value >= 0 && value <= maximum ? value : 0
  );
}

/** Speed over time for the pace curve, kept on this device. Seconds count from the first fix; speed is m/s over the trailing window. */
export function computeStream(locations: readonly Location[]): ActivityStream | undefined {
  const first = locations[0];
  if (!first || locations.length < 2) return undefined;

  const cumulative: number[] = [0];
  for (let i = 1; i < locations.length; i++) {
    const a = locations[i - 1] as Location;
    const b = locations[i] as Location;
    cumulative.push(
      (cumulative[i - 1] as number) +
        haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude)
    );
  }

  const t: number[] = [];
  const speed: number[] = [];
  const d: number[] = [];
  let start = 0;
  for (let i = 0; i < locations.length; i++) {
    const at = locations[i] as Location;
    while (
      start < i - 1 &&
      at.timestamp - (locations[start + 1] as Location).timestamp >= WINDOW_MS
    ) {
      start++;
    }
    const from = locations[start] as Location;
    const seconds = (at.timestamp - from.timestamp) / 1000;
    const metres = (cumulative[i] as number) - (cumulative[start] as number);
    t.push(Math.round((at.timestamp - first.timestamp) / 1000));
    speed.push(seconds > 0 ? Math.round((metres / seconds) * 100) / 100 : 0);
    d.push(Math.round(cumulative[i] as number));
  }
  const startedAt = first.timestamp;
  const alt = alignedAltitudes(locations);

  if (t.length <= MAX_STREAM_POINTS) return { t, speed, d, startedAt, ...(alt && { alt }) };
  const step = (t.length - 1) / (MAX_STREAM_POINTS - 1);
  const picks = Array.from({ length: MAX_STREAM_POINTS }, (_, k) => Math.round(k * step));
  return {
    t: picks.map((i) => t[i] as number),
    speed: picks.map((i) => speed[i] as number),
    d: picks.map((i) => d[i] as number),
    startedAt,
    ...(alt && { alt: picks.map((i) => alt[i] as number) }),
  };
}
