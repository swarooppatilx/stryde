export type GoalPresetId = 'getMoving' | 'steady' | 'ambitious';

export interface GoalPreset {
  id: GoalPresetId;
  title: string;
  /** Activities per week. */
  activities: number;
  /** Distance per week, in meters. */
  distance: number;
}

export const GOAL_PRESETS: readonly GoalPreset[] = [
  { id: 'getMoving', title: 'Get moving', activities: 2, distance: 10000 },
  { id: 'steady', title: 'Steady', activities: 3, distance: 20000 },
  { id: 'ambitious', title: 'Ambitious', activities: 5, distance: 40000 },
];

/** The preset whose numbers match a pair of goals, or null when they are the athlete's own. */
export function presetFor(activities: number, distance: number): GoalPreset | null {
  return GOAL_PRESETS.find((p) => p.activities === activities && p.distance === distance) ?? null;
}
