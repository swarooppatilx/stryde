import { useProfileStore } from '@/stores/profileStore';
import type { UnitSystem } from '@/utils/format';

/** Resolve the user's preferred unit system for displaying distance, pace, and area. */
export function useUnitSystem(): UnitSystem {
  return useProfileStore((s) => s.settings.units);
}
