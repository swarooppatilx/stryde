export interface HeartRateZone {
  id: 1 | 2 | 3 | 4 | 5;
  label: string;
}

/** Where zones 2 to 5 begin, as a share of maximum heart rate (or of the reserve when a resting rate is known). */
export type ZoneFloors = readonly [number, number, number, number];
export const DEFAULT_ZONE_FLOORS: ZoneFloors = [0.6, 0.7, 0.8, 0.9];

/** The widest and narrowest a boundary can be set, in percent: below 30 is not exercise, 100 leaves no room above. */
const MIN_FLOOR_PERCENT = 30;
const MAX_FLOOR_PERCENT = 99;

/**
 * Four boundaries typed in as whole percentages, or null when one is missing, odd, out of range, or
 * they do not rise (a zone would have no room).
 */
export function parseZoneFloors(texts: readonly string[]): ZoneFloors | null {
  if (texts.length !== 4) return null;
  const percents = texts.map((text) => (/^\d{2}$/.test(text.trim()) ? Number(text) : Number.NaN));
  if (percents.some((p) => !(p >= MIN_FLOOR_PERCENT && p <= MAX_FLOOR_PERCENT))) return null;
  const [a, b, c, d] = percents;
  if (a === undefined || b === undefined || c === undefined || d === undefined) return null;
  if (!(a < b && b < c && c < d)) return null;
  return [a / 100, b / 100, c / 100, d / 100];
}

/** Five zones by share of maximum heart rate with the usual thresholds; real zones depend on a measured maximum, which can differ a lot from the age estimate. */
export const HEART_RATE_ZONES: readonly HeartRateZone[] = [
  { id: 1, label: 'Recovery' },
  { id: 2, label: 'Endurance' },
  { id: 3, label: 'Tempo' },
  { id: 4, label: 'Threshold' },
  { id: 5, label: 'Max effort' },
];

/** A reading is believable between these; anything else is a sensor dropout. */
const MIN_BPM = 30;
const MAX_BPM = 250;
/** A reading is taken to last until the next one, but no longer than this: a dropout is not time in a zone. */
export const MAX_READING_GAP_S = 120;

/**
 * Effort as a share of the heart-rate reserve (between resting and maximum) when a sensible resting
 * rate is known, else as a share of the maximum. The reserve method reads a fit athlete's easy
 * pace as easier than the plain percentage does.
 */
export function reserveShare(bpm: number, maxHr: number, restingHr?: number): number {
  if (restingHr === undefined || !(restingHr > 0) || restingHr >= maxHr) return bpm / maxHr;
  return (bpm - restingHr) / (maxHr - restingHr);
}

export function zoneOf(
  bpm: number,
  maxHr: number,
  restingHr?: number,
  floors: ZoneFloors = DEFAULT_ZONE_FLOORS
): HeartRateZone['id'] {
  const share = reserveShare(bpm, maxHr, restingHr);
  let zone: HeartRateZone['id'] = 1;
  floors.forEach((floor, i) => {
    if (share >= floor) zone = (i + 2) as HeartRateZone['id'];
  });
  return zone;
}

export interface ZoneTime {
  zone: HeartRateZone;
  seconds: number;
  /** Share of the time measured (0 to 1). */
  share: number;
}

/**
 * Seconds spent in each zone. A reading counts until the next one arrives; the last one counts for
 * the gap before it, so the end of an activity is not lost. Empty when there is nothing to measure.
 */
export function timeInZones(
  heartRate: { t: readonly number[]; bpm: readonly number[] },
  maxHr: number,
  restingHr?: number,
  floors: ZoneFloors = DEFAULT_ZONE_FLOORS
): ZoneTime[] {
  const { t, bpm } = heartRate;
  if (t.length === 0 || t.length !== bpm.length || !(maxHr > 0)) return [];

  const seconds = HEART_RATE_ZONES.map(() => 0);
  for (let i = 0; i < t.length; i++) {
    const reading = bpm[i] as number;
    if (!(reading >= MIN_BPM && reading <= MAX_BPM)) continue;
    const next = t[i + 1];
    const gap = next === undefined ? (t[i] as number) - (t[i - 1] ?? 0) : next - (t[i] as number);
    if (!(gap > 0)) continue;
    const index = zoneOf(reading, maxHr, restingHr, floors) - 1;
    seconds[index] = (seconds[index] as number) + Math.min(gap, MAX_READING_GAP_S);
  }

  const total = seconds.reduce((sum, value) => sum + value, 0);
  if (total === 0) return [];
  return HEART_RATE_ZONES.map((zone, i) => ({
    zone,
    seconds: seconds[i] as number,
    share: (seconds[i] as number) / total,
  }));
}

/** The boundaries as whole-percent text for the editing fields; the usual ones when none were chosen. */
export function zoneFloorsToTexts(floors: ZoneFloors | undefined): string[] {
  return (floors ?? DEFAULT_ZONE_FLOORS).map((floor) => String(Math.round(floor * 100)));
}

/** Whether two sets of boundaries are the same to the whole percent. */
export function sameFloors(a: ZoneFloors, b: ZoneFloors): boolean {
  return a.every((floor, i) => Math.round(floor * 100) === Math.round((b[i] as number) * 100));
}
