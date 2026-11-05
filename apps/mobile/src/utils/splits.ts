import type { Location, Split } from '@/types';
import { alignedAltitudes, smoothAltitudes } from './elevation';
import { haversineDistance } from './geo';

/** A gap this long between two fixes is a stop (pause, traffic light), not running time. */
export const STOP_GAP_MS = 30_000;
export const STOP_SPEED_MS = 0.3;
/** Rounding in the distance maths leaves slivers; a split shorter than this isn't worth showing. */
const MIN_PARTIAL_SPLIT_M = 10;

export function computeSplits(locations: readonly Location[], splitMeters: number): Split[] {
  const splits: Split[] = [];
  let distance = 0;
  let movingTime = 0;
  const raw = alignedAltitudes(locations);
  const altitudes = raw ? smoothAltitudes(raw) : null;
  let startAltitude = altitudes?.[0] ?? 0;

  for (let i = 1; i < locations.length; i++) {
    const from = locations[i - 1] as Location;
    const to = locations[i] as Location;
    const meters = haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
    const elapsed = Math.max(0, to.timestamp - from.timestamp);
    const stopped = elapsed > STOP_GAP_MS && meters / (elapsed / 1000) < STOP_SPEED_MS;
    let remainingMeters = meters;
    const msPerMeter = !stopped && meters > 0 ? elapsed / meters : 0;
    const altitudeFrom = altitudes?.[i - 1] ?? 0;
    const altitudeTo = altitudes?.[i] ?? 0;
    const altitudeAt = (travelled: number) =>
      meters > 0 ? altitudeFrom + (altitudeTo - altitudeFrom) * (travelled / meters) : altitudeTo;

    while (distance + remainingMeters >= splitMeters) {
      const take = splitMeters - distance;
      const endAltitude = altitudeAt(meters - remainingMeters + take);
      splits.push({
        index: splits.length + 1,
        distance: splitMeters,
        movingTime: movingTime + take * msPerMeter,
        ...(altitudes && { elevation: Math.round(endAltitude - startAltitude) }),
      });
      startAltitude = endAltitude;
      remainingMeters -= take;
      distance = 0;
      movingTime = 0;
    }
    distance += remainingMeters;
    movingTime += remainingMeters * msPerMeter;
  }

  if (distance >= MIN_PARTIAL_SPLIT_M) {
    const last = altitudes?.[altitudes.length - 1] ?? 0;
    splits.push({
      index: splits.length + 1,
      distance,
      movingTime,
      ...(altitudes && { elevation: Math.round(last - startAltitude) }),
    });
  }
  return splits;
}
