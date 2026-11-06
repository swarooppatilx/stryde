import { useEffect, useState } from 'react';
import { getPlatform } from '@/platform';
import type { BatteryState } from '@/platform/ports';
import { ACCURACY_MODE_CONFIG, useSettingsStore } from '@/stores/settingsStore';
import { effectiveTrackingProfile, type TrackingProfile } from '@/utils/lowPower';

/** The GPS profile a recording started now would use, following battery saver and charge changes. */
export function useBatteryProfile(): TrackingProfile {
  const accuracyMode = useSettingsStore((s) => s.accuracyMode);
  const adjustInBatterySaver = useSettingsStore((s) => s.adjustGpsInBatterySaver);
  const [battery, setBattery] = useState<BatteryState | null>(null);

  useEffect(() => {
    const { battery: source } = getPlatform();
    let live = true;
    source
      .getState()
      .then((state) => live && setBattery(state))
      .catch(() => {});
    const subscription = source.subscribe(setBattery);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  return effectiveTrackingProfile(
    {
      accuracyMode,
      timeIntervalMs: ACCURACY_MODE_CONFIG[accuracyMode].timeInterval,
      adjustInBatterySaver,
    },
    battery
  );
}
