import type { Gender } from '@/types';
import { ageOn } from './age';
import { parseCalendarDay } from './dates';
import type { UnitSystem } from './format';

const CM_PER_INCH = 2.54;
const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 250;

/** Body mass index, to one decimal; null without a usable weight and height. */
export function bmi(weightKg: number | undefined, heightCm: number | undefined): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return Math.round((weightKg / (meters * meters)) * 10) / 10;
}

/** Plain-words band for a BMI. It is a rough population measure, not a verdict on one person. */
export function bmiBand(value: number): string {
  if (value < 18.5) return 'Below the usual range';
  if (value < 25) return 'In the usual range';
  if (value < 30) return 'Above the usual range';
  return 'Well above the usual range';
}

interface BasalInput {
  weightKg?: number;
  heightCm?: number;
  age?: number;
  gender: Gender;
}

function sexTermOtherThanMan(gender: BasalInput['gender']): number {
  return gender === 'woman' ? -161 : -78;
}

/**
 * Calories the body uses at rest in a day (Mifflin-St Jeor). The sex term is +5 for men and -161
 * for women; for anyone else, or when it is not given, the midpoint (-78) is used.
 */
export function basalCalories({ weightKg, heightCm, age, gender }: BasalInput): number | null {
  if (!weightKg || !heightCm || age === undefined || age < 0) return null;
  const term = gender === 'man' ? 5 : sexTermOtherThanMan(gender);
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + term);
}

/** Estimated maximum heart rate from age (Tanaka: 208 - 0.7 x age); null for an unknown or impossible age. */
export function maxHeartRate(age: number | undefined): number | null {
  if (age === undefined || age < 0 || age > 120) return null;
  return Math.round(208 - 0.7 * age);
}

/** A height typed in centimetres, or in feet and inches ("5'10", "5 10", "5-10") or plain inches. Null if unusable. */
export function parseHeightCm(text: string, unitSystem: UnitSystem): number | null {
  const input = text.trim().replace(',', '.');
  if (input === '') return null;
  let cm: number;
  if (unitSystem === 'imperial') {
    const feetInches = /^(\d)\s*(?:'|ft|-|\s)\s*(\d{1,2}(?:\.\d+)?)\s*(?:"|in)?$/.exec(input);
    if (feetInches) {
      cm = (Number(feetInches[1]) * 12 + Number(feetInches[2])) * CM_PER_INCH;
    } else {
      const inches = Number(input);
      if (!Number.isFinite(inches)) return null;
      cm = inches * CM_PER_INCH;
    }
  } else {
    cm = Number(input);
    if (!Number.isFinite(cm)) return null;
  }
  return cm >= MIN_HEIGHT_CM && cm <= MAX_HEIGHT_CM ? cm : null;
}

export function formatHeight(heightCm: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'metric') return `${Math.round(heightCm)} cm`;
  const totalInches = Math.round(heightCm / CM_PER_INCH);
  return `${Math.floor(totalInches / 12)}'${totalInches % 12}"`;
}

export interface WeightEntry {
  /** Calendar day, `YYYY-MM-DD`. */
  day: string;
  kg: number;
}

/** Kilograms gained (positive) or lost (negative) over the last `days` days, or null with fewer than two entries in that window. */
export function weightChange(
  entries: readonly WeightEntry[],
  days: number,
  today: string
): number | null {
  const end = Date.parse(`${today}T00:00:00Z`);
  const inWindow = entries
    .filter((e) => {
      const at = Date.parse(`${e.day}T00:00:00Z`);
      return at <= end && end - at <= days * 86_400_000;
    })
    .sort((a, b) => a.day.localeCompare(b.day));
  const first = inWindow[0];
  const last = inWindow.at(-1);
  if (!first || !last || inWindow.length < 2) return null;
  return last.kg - first.kg;
}

/** A maximum heart rate typed in: a whole number of beats per minute a person can actually have. */
export function parseMaxHeartRate(text: string): number | null {
  const input = text.trim();
  if (!/^\d{3}$/.test(input)) return null;
  const bpm = Number(input);
  return bpm >= 120 && bpm <= 230 ? bpm : null;
}

/** A resting heart rate typed in: a whole number of beats per minute between 30 and 120. */
export function parseRestingHeartRate(text: string): number | null {
  const input = text.trim();
  if (!/^\d{2,3}$/.test(input)) return null;
  const bpm = Number(input);
  return bpm >= 30 && bpm <= 120 ? bpm : null;
}

export interface BodySummary {
  age: number | null;
  bmi: number | null;
  bmiBand: string | null;
  basalCalories: number | null;
  /** The athlete's own figure when they gave one, else the age estimate. */
  maxHeartRate: number | null;
  /** True when `maxHeartRate` is the athlete's own figure, not an estimate. */
  maxHeartRateMeasured: boolean;
}

/** Every figure derivable from the athlete's profile; the rest are null. */
export function summariseBody(
  input: {
    weightKg?: number;
    heightCm?: number;
    birthday?: string | null;
    gender: Gender;
    maxHeartRate?: number;
  },
  now: Date
): BodySummary {
  const age = input.birthday ? ageOn(parseCalendarDay(input.birthday), now) : null;
  const index = bmi(input.weightKg, input.heightCm);
  return {
    age,
    bmi: index,
    bmiBand: index === null ? null : bmiBand(index),
    basalCalories: basalCalories({
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      age: age ?? undefined,
      gender: input.gender,
    }),
    maxHeartRate: input.maxHeartRate ?? maxHeartRate(age ?? undefined),
    maxHeartRateMeasured: input.maxHeartRate !== undefined,
  };
}
