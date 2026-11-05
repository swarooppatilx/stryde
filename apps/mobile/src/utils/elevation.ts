import type { Location } from '@/types';

/** A climb or descent counts only once it reaches this many metres; smaller swings are sensor noise. */
const BANK_THRESHOLD_M = 8;
/** Two neighbouring readings further apart than this are a sensor fault, not a hill. */
const JUMP_RESET_M = 10;
/** Vertical accuracy worse than this (m) makes an altitude not worth using. */
const MAX_VERTICAL_ACCURACY_M = 20;
/** Fewer usable altitudes than this say nothing about the route. */
const MIN_ALTITUDES = 10;
const SMOOTH_WINDOW = 5;

export interface ClimbOptions {
  /**
   * Restart the count after a jump between neighbouring readings (default). A track thinned down to
   * a few hundred points has real hills that steep between readings, so it turns this off.
   */
  resetOnJump?: boolean;
}

/**
 * Metres climbed and descended along a series of altitudes. A rise is added only once it has
 * reached `BANK_THRESHOLD_M` above the lowest point of the current climb, and then grows with it;
 * a dip of that size from the peak starts a new climb. Descent is the same around the highest
 * point. So jitter on a flat road adds nothing, while real hills add up however many there are.
 */
export function climbAndDescent(
  altitudes: readonly number[],
  { resetOnJump = true }: ClimbOptions = {}
): { gain: number; loss: number } {
  const first = altitudes[0];
  if (first === undefined) return { gain: 0, loss: 0 };

  let gain = 0;
  let loss = 0;
  // Climb: lowest point, highest since then, and how much of the rise is already in `gain`.
  let low = first;
  let peak = first;
  let climbBanked = 0;
  // Descent: the mirror image.
  let high = first;
  let trough = first;
  let dropBanked = 0;
  let last = first;

  for (let i = 1; i < altitudes.length; i++) {
    const alt = altitudes[i] as number;
    if (resetOnJump && Math.abs(alt - last) > JUMP_RESET_M) {
      low = peak = high = trough = alt;
      climbBanked = dropBanked = 0;
      last = alt;
      continue;
    }
    last = alt;

    if (alt < low) {
      low = peak = alt;
      climbBanked = 0;
    } else if (alt > peak) {
      peak = alt;
      const climb = peak - low;
      if (climb >= BANK_THRESHOLD_M && climb > climbBanked) {
        gain += climb - climbBanked;
        climbBanked = climb;
      }
    } else if (peak - alt >= BANK_THRESHOLD_M) {
      low = peak = alt;
      climbBanked = 0;
    }

    if (alt > high) {
      high = trough = alt;
      dropBanked = 0;
    } else if (alt < trough) {
      trough = alt;
      const drop = high - trough;
      if (drop >= BANK_THRESHOLD_M && drop > dropBanked) {
        loss += drop - dropBanked;
        dropBanked = drop;
      }
    } else if (alt - trough >= BANK_THRESHOLD_M) {
      high = trough = alt;
      dropBanked = 0;
    }
  }
  return { gain, loss };
}

/** A moving average over a few neighbours, so a single bad reading does not make a hill. */
export function smoothAltitudes(values: readonly number[]): number[] {
  if (values.length < SMOOTH_WINDOW) return [...values];
  const half = Math.floor(SMOOTH_WINDOW / 2);
  return values.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(values.length, i + half + 1);
    let sum = 0;
    for (let n = from; n < to; n++) sum += values[n] as number;
    return sum / (to - from);
  });
}

/** The altitudes worth using from a recording; null when too few fixes carry one. */
export function usableAltitudes(locations: readonly Location[]): number[] | null {
  const values: number[] = [];
  for (const fix of locations) {
    if (fix.altitude === undefined || !Number.isFinite(fix.altitude)) continue;
    if (fix.verticalAccuracy !== undefined && fix.verticalAccuracy > MAX_VERTICAL_ACCURACY_M) {
      continue;
    }
    values.push(fix.altitude);
  }
  return values.length >= MIN_ALTITUDES ? values : null;
}

/** Whole metres climbed and descended over a recording, or null when it carries no usable altitude. */
export function elevationOf(locations: readonly Location[]): { gain: number; loss: number } | null {
  const altitudes = usableAltitudes(locations);
  if (!altitudes) return null;
  const { gain, loss } = climbAndDescent(altitudes);
  return { gain: Math.round(gain), loss: Math.round(loss) };
}

export interface ElevationProfile {
  elevations: number[];
  totalAscent: number;
  totalDescent: number;
  minElevation: number;
  maxElevation: number;
}

/**
 * What the activity page draws, from the altitudes saved with the recording, so it needs no
 * network. The stored climb and descent win when present (they come from the full-rate track).
 */
export function elevationProfile(
  stream: { alt?: number[] } | undefined,
  storedGain?: number,
  storedLoss?: number
): ElevationProfile | null {
  const elevations = stream?.alt;
  if (!elevations || elevations.length < 2) return null;
  const computed = climbAndDescent(elevations, { resetOnJump: false });
  return {
    elevations,
    totalAscent: storedGain ?? Math.round(computed.gain),
    totalDescent: storedLoss ?? Math.round(computed.loss),
    minElevation: Math.min(...elevations),
    maxElevation: Math.max(...elevations),
  };
}

/** Altitude at every fix, a missing one filled from the last known; null when the recording has too few to use. */
export function alignedAltitudes(locations: readonly Location[]): number[] | null {
  if (!usableAltitudes(locations)) return null;
  const firstKnown = locations.find((l) => l.altitude !== undefined && Number.isFinite(l.altitude));
  let last = Math.round(((firstKnown?.altitude as number) ?? 0) * 10) / 10;
  return locations.map((l) => {
    if (l.altitude !== undefined && Number.isFinite(l.altitude))
      last = Math.round(l.altitude * 10) / 10;
    return last;
  });
}
