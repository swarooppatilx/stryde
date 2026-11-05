import type { ActivityType } from '@/types';
import type { UnitSystem } from './format';

const KG_PER_LB = 0.45359237;
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;

/** Energy per kilogram of body weight per kilometre on foot (compendium averages). */
const KCAL_PER_KG_KM: Partial<Record<ActivityType, number>> = { run: 1.036, walk: 0.53, hike: 0.7 };

/**
 * Sports with no distance-based formula: energy from time spent, as MET (multiples of resting
 * energy) from the standard compendium averages: an hour at MET m costs about m x weight kcal.
 */
const TIME_MET: Partial<Record<ActivityType, number>> = {
  swim: 7,
  row: 7,
  skate: 7,
  climb: 8,
  yoga: 2.5,
  workout: 5,
  hiit: 8,
  dance: 5,
};

/** Cycling MET by average speed in km/h. */
function rideMet(kmh: number): number {
  if (kmh < 16) return 6;
  if (kmh < 20) return 8;
  if (kmh < 25) return 10;
  return 12;
}

interface CalorieInput {
  activityType: ActivityType;
  /** Meters. */
  distance: number;
  /** Moving time in ms. */
  duration: number;
  weightKg?: number | null;
}

/** A rough kcal figure from weight, sport and distance; null when no honest figure exists. */
export function estimateCalories({
  activityType,
  distance,
  duration,
  weightKg,
}: CalorieInput): number | null {
  if (!weightKg || duration <= 0) return null;
  const timeMet = TIME_MET[activityType];
  if (timeMet !== undefined) return Math.round(timeMet * weightKg * (duration / 3_600_000));
  // The rest work out from distance, so they need some.
  if (distance <= 0) return null;
  const perKm = KCAL_PER_KG_KM[activityType];
  if (perKm !== undefined) return Math.round(perKm * weightKg * (distance / 1000));
  if (activityType === 'ride') {
    const hours = duration / 3_600_000;
    return Math.round(rideMet(distance / 1000 / hours) * weightKg * hours);
  }
  return null;
}

/** Reads what the athlete typed (kg or lb by their unit setting) as kilograms, or null if unusable. */
export function parseWeightKg(text: string, unitSystem: UnitSystem): number | null {
  const value = Number.parseFloat(text.trim().replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const kg = unitSystem === 'imperial' ? value * KG_PER_LB : value;
  return kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG ? kg : null;
}

/** The accepted weight range in the athlete's unit, for an error message: "between 20 and 400 kg". */
export function weightRangeText(unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    return `between ${Math.ceil(MIN_WEIGHT_KG / KG_PER_LB)} and ${Math.floor(MAX_WEIGHT_KG / KG_PER_LB)} lb`;
  }
  return `between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg`;
}

/** Stored kilograms as a number in the athlete's unit, without a suffix. */
export function formatWeight(kg: number, unitSystem: UnitSystem): string {
  const value = unitSystem === 'imperial' ? kg / KG_PER_LB : kg;
  return String(Math.round(value * 10) / 10);
}
