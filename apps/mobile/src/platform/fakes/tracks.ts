import type { Location } from '@/types';
import { FAKE_EPOCH_MS } from './device';

const METERS_PER_DEG_LAT = 111_320;

interface LatLng {
  latitude: number;
  longitude: number;
}

/** Shaniwar Wada, Pune — the demo city. */
export const PUNE: LatLng = { latitude: 18.5204, longitude: 73.8567 };

interface TrackTiming {
  /** Seconds between fixes. */
  intervalS?: number;
  startTime?: number;
  accuracy?: number;
}

function offset(origin: LatLng, northM: number, eastM: number): LatLng {
  const cosLat = Math.cos((origin.latitude * Math.PI) / 180);
  return {
    latitude: origin.latitude + northM / METERS_PER_DEG_LAT,
    longitude: origin.longitude + eastM / (METERS_PER_DEG_LAT * cosLat),
  };
}

/** Constant-speed walk/run along one bearing (0 = north, 90 = east). */
export function straightTrack(
  options: {
    from?: LatLng;
    bearingDeg?: number;
    speedMps: number;
    durationS: number;
  } & TrackTiming
): Location[] {
  const { from = PUNE, bearingDeg = 0, speedMps, durationS } = options;
  const { intervalS = 2, startTime = FAKE_EPOCH_MS, accuracy = 5 } = options;
  const bearing = (bearingDeg * Math.PI) / 180;
  const fixes: Location[] = [];
  for (let t = 0; t <= durationS; t += intervalS) {
    const metres = speedMps * t;
    fixes.push({
      ...offset(from, metres * Math.cos(bearing), metres * Math.sin(bearing)),
      timestamp: startTime + t * 1000,
      accuracy,
    });
  }
  return fixes;
}

/** Constant-speed circuit that ends exactly where it started, so it reads as a closed loop. */
export function loopTrack(
  options: { center?: LatLng; radiusM: number; speedMps: number; laps?: number } & TrackTiming
): Location[] {
  const { center = PUNE, radiusM, speedMps, laps = 1 } = options;
  const { intervalS = 2, startTime = FAKE_EPOCH_MS, accuracy = 5 } = options;
  const totalS = (2 * Math.PI * radiusM * laps) / speedMps;
  const fixes: Location[] = [];
  const at = (t: number): Location => {
    const angle = (speedMps * t) / radiusM;
    return {
      ...offset(center, radiusM * Math.cos(angle), radiusM * Math.sin(angle)),
      timestamp: startTime + Math.round(t * 1000),
      accuracy,
    };
  };
  for (let t = 0; t < totalS; t += intervalS) fixes.push(at(t));
  fixes.push(at(totalS));
  return fixes;
}

/** Copy of `track` with one fix thrown `meters` sideways — a GPS glitch. */
export function withJump(track: Location[], index: number, meters: number): Location[] {
  return track.map((fix, i) =>
    i === index ? { ...fix, ...offset(fix, 0, meters), timestamp: fix.timestamp } : fix
  );
}

/** `items[index]`, failing the test loudly instead of passing `undefined` along. */
export function at<T>(items: readonly T[], index: number): T {
  const item = items.at(index);
  if (item === undefined) throw new Error(`No item at index ${index} (length ${items.length})`);
  return item;
}
