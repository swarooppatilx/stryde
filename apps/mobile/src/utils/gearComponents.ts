import type { Activity, Gear, GearComponent } from '@/types';

export const GEAR_NEAR_RATIO = 0.9;

export type ComponentLevel = 'ok' | 'near' | 'over';

export interface ComponentUsage {
  distance: number;
  time: number;
}

const RANK: Record<ComponentLevel, number> = { ok: 0, near: 1, over: 2 };

/** Distance (m) and moving time (ms) the parent gear covered since this part was installed. */
export function componentUsage(
  component: GearComponent,
  gearId: string,
  activities: readonly Activity[]
): ComponentUsage {
  const usage: ComponentUsage = { distance: 0, time: 0 };
  for (const a of activities) {
    if (a.gearId !== gearId || a.createdAt.getTime() < component.installedAt) continue;
    usage.distance += a.distance;
    usage.time += a.duration;
  }
  return usage;
}

/** How far through its budget a part is, by whichever of distance or time is further along. */
export function componentStatus(
  component: GearComponent,
  usage: ComponentUsage
): { ratio: number; level: ComponentLevel } {
  const ratios: number[] = [];
  if (component.budgetDistance && component.budgetDistance > 0) {
    ratios.push(usage.distance / component.budgetDistance);
  }
  if (component.budgetTime && component.budgetTime > 0) {
    ratios.push(usage.time / component.budgetTime);
  }
  const ratio = ratios.length > 0 ? Math.max(...ratios) : 0;
  if (ratio >= 1) return { ratio, level: 'over' };
  if (ratio >= GEAR_NEAR_RATIO) return { ratio, level: 'near' };
  return { ratio, level: 'ok' };
}

/** The most worn level among a gear item's parts. */
export function gearAlertLevel(gear: Gear, activities: readonly Activity[]): ComponentLevel {
  let worst: ComponentLevel = 'ok';
  for (const c of gear.components ?? []) {
    const { level } = componentStatus(c, componentUsage(c, gear.id, activities));
    if (RANK[level] > RANK[worst]) worst = level;
  }
  return worst;
}

/** A positive number typed with a comma or a dot, or undefined for blank and anything else. */
export function parsePositive(text: string): number | undefined {
  const n = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
