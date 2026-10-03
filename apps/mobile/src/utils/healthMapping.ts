import { climbAndDescent } from './elevation';

/** Heart rate outside this is a sensor fault, not a heart. */
const MIN_BPM = 30;
const MAX_BPM = 230;
const DEFAULT_MAX_HEART_POINTS = 240;
const DEFAULT_MAX_ROUTE_POINTS = 1500;
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;
const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 250;

/** Health Connect writes a length as a value and a unit. */
export interface HealthLength {
  value: number;
  unit: 'meters' | 'kilometers' | 'miles' | 'inches' | 'feet';
}

export interface HealthMass {
  value: number;
  unit: 'grams' | 'kilograms' | 'milligrams' | 'micrograms' | 'ounces' | 'pounds';
}

const METERS_PER: Record<HealthLength['unit'], number> = {
  meters: 1,
  kilometers: 1000,
  miles: 1609.344,
  inches: 0.0254,
  feet: 0.3048,
};

const KG_PER: Record<HealthMass['unit'], number> = {
  grams: 0.001,
  kilograms: 1,
  milligrams: 0.000001,
  micrograms: 0.000000001,
  ounces: 0.028349523125,
  pounds: 0.45359237,
};

export const lengthToMeters = (length: HealthLength): number =>
  length.value * METERS_PER[length.unit];
export const massToKg = (mass: HealthMass): number => mass.value * KG_PER[mass.unit];

/** Picks `max` points spread evenly over a list, always keeping the first and the last. */
function thin<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return [...items];
  const step = (items.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, k) => items[Math.round(k * step)] as T);
}

export interface HeartRateSummary {
  avg: number;
  max: number;
  /** Seconds since the workout began, and beats per minute at each. */
  series: { t: number[]; bpm: number[] };
}

/** Average, highest and a thinned series from a workout's heart-rate readings; null when none are usable. */
export function summariseHeartRate(
  samples: ReadonlyArray<{ time: string; beatsPerMinute: number }>,
  startMs: number,
  maxPoints: number = DEFAULT_MAX_HEART_POINTS
): HeartRateSummary | null {
  const usable = samples
    .filter((s) => s.beatsPerMinute >= MIN_BPM && s.beatsPerMinute <= MAX_BPM)
    .map((s) => ({
      t: Math.max(0, Math.round((Date.parse(s.time) - startMs) / 1000)),
      bpm: Math.round(s.beatsPerMinute),
    }))
    .filter((s) => Number.isFinite(s.t))
    .sort((a, b) => a.t - b.t);
  if (usable.length === 0) return null;

  const kept = thin(usable, maxPoints);
  const total = usable.reduce((sum, s) => sum + s.bpm, 0);
  return {
    avg: Math.round(total / usable.length),
    max: Math.max(...usable.map((s) => s.bpm)),
    series: { t: kept.map((s) => s.t), bpm: kept.map((s) => s.bpm) },
  };
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp: number;
}

/** The route a watch recorded, as timed fixes (thinned to a size worth saving); null with fewer than two good points. */
export function routeFromHealth(
  points: ReadonlyArray<{
    time: string;
    latitude: number;
    longitude: number;
    altitude?: HealthLength;
  }>,
  maxPoints: number = DEFAULT_MAX_ROUTE_POINTS
): RoutePoint[] | null {
  const good: RoutePoint[] = [];
  for (const p of points) {
    const timestamp = Date.parse(p.time);
    const valid =
      Number.isFinite(timestamp) &&
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude) &&
      Math.abs(p.latitude) <= 90 &&
      Math.abs(p.longitude) <= 180;
    if (!valid) continue;
    good.push({
      latitude: p.latitude,
      longitude: p.longitude,
      ...(p.altitude &&
        Number.isFinite(p.altitude.value) && { altitude: lengthToMeters(p.altitude) }),
      timestamp,
    });
  }
  return good.length >= 2 ? thin(good, maxPoints) : null;
}

/** Whole metres climbed and descended along a route's altitudes; null when it has too few to say. */
export function climbOfRoute(route: readonly RoutePoint[]): { gain: number; loss: number } | null {
  const altitudes = route.flatMap((p) => (p.altitude === undefined ? [] : [p.altitude]));
  if (altitudes.length < 10) return null;
  const { gain, loss } = climbAndDescent(altitudes);
  return { gain: Math.round(gain), loss: Math.round(loss) };
}

export interface HealthBody {
  weightKg?: number;
  heightCm?: number;
  restingHeartRate?: number;
}

const newest = <T extends { time: string }>(records: readonly T[]): T | undefined =>
  [...records].sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0];

/** The latest weight, height and resting heart rate the health data holds, each only if it is plausible. */
export function bodyFromHealth(records: {
  weights: ReadonlyArray<{ time: string; weight: HealthMass }>;
  heights: ReadonlyArray<{ time: string; height: HealthLength }>;
  resting: ReadonlyArray<{ time: string; beatsPerMinute: number }>;
}): HealthBody {
  const latestWeight = newest(records.weights)?.weight;
  const latestHeight = newest(records.heights)?.height;
  const kg = latestWeight ? massToKg(latestWeight) : undefined;
  const cm = (latestHeight ? lengthToMeters(latestHeight) : Number.NaN) * 100;
  const resting = newest(records.resting)?.beatsPerMinute;
  const body: HealthBody = {};
  if (kg !== undefined && kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG) {
    body.weightKg = Math.round(kg * 10) / 10;
  }
  if (cm >= MIN_HEIGHT_CM && cm <= MAX_HEIGHT_CM) body.heightCm = Math.round(cm * 10) / 10;
  if (resting !== undefined && resting >= MIN_BPM && resting <= 120) {
    body.restingHeartRate = Math.round(resting);
  }
  return body;
}
