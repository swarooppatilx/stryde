import { useCallback } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ActivityType } from '@/types';
import {
  type LiveStatId,
  liveStatChoices,
  liveStatFamily,
  resolveLiveStatLayout,
} from '@/utils/liveStats';

/** The figures the Record screen shows for this sport, the ones it could show, and a way to swap them. */
export function useLiveStatLayout(activityType: ActivityType) {
  const family = liveStatFamily(activityType);
  const saved = useSettingsStore((s) => s.liveStatSlots[family]);
  const setSlot = useSettingsStore((s) => s.setLiveStatSlot);
  // The screen ticks every second; the layout only changes when the athlete picks a field.
  const layout = resolveLiveStatLayout(family, saved);
  const choices = liveStatChoices(family);
  const choose = useCallback(
    (slot: number, id: LiveStatId) => setSlot(family, slot, id),
    [family, setSlot]
  );
  return { layout, choices, choose };
}
