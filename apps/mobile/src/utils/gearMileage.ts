import type { Activity, ActivityType, Gear, GearKind } from '@/types';

const KIND_BY_SPORT: Partial<Record<ActivityType, GearKind>> = {
  run: 'shoes',
  walk: 'shoes',
  hike: 'shoes',
  ride: 'bike',
};

/** Meters: what the gear covered before it was added here, plus the activities that used it. */
export function gearMileage(gear: Gear, activities: readonly Activity[]): number {
  return activities.reduce(
    (total, a) => (a.gearId === gear.id ? total + a.distance : total),
    gear.startingDistance
  );
}

/** The gear an athlete can pick for this sport: still in use, and the right kind. */
export function gearForSport(gear: readonly Gear[], sport: ActivityType): Gear[] {
  const kind = KIND_BY_SPORT[sport];
  return kind ? gear.filter((g) => g.kind === kind && !g.retired) : [];
}
