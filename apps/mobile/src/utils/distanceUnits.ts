import type { UnitSystem } from '@/utils/format';

const METERS_PER_MILE = 1609.344;

/** How many metres one kilometre or one mile is, by the athlete's unit setting. */
export function metersPerDistanceUnit(unitSystem: UnitSystem): number {
  return unitSystem === 'imperial' ? METERS_PER_MILE : 1000;
}

export function distanceUnitLabel(unitSystem: UnitSystem): 'km' | 'mi' {
  return unitSystem === 'imperial' ? 'mi' : 'km';
}

/** A distance typed in the athlete's unit, as whole metres; 0 when it is blank, not a number or negative. */
export function parseDistanceMeters(text: string, unitSystem: UnitSystem): number {
  const value = Number.parseFloat(text.trim().replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * metersPerDistanceUnit(unitSystem));
}
