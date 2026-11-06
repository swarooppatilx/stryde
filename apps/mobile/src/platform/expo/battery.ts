import * as ExpoBattery from 'expo-battery';
import type { Battery, BatteryState } from '@/platform/ports';

const UNKNOWN: BatteryState = { level: -1, lowPowerMode: false, charging: false };

async function read(): Promise<BatteryState> {
  try {
    const [level, lowPowerMode, state] = await Promise.all([
      ExpoBattery.getBatteryLevelAsync(),
      ExpoBattery.isLowPowerModeEnabledAsync(),
      ExpoBattery.getBatteryStateAsync(),
    ]);
    return {
      level,
      lowPowerMode,
      charging:
        state === ExpoBattery.BatteryState.CHARGING || state === ExpoBattery.BatteryState.FULL,
    };
  } catch {
    return UNKNOWN;
  }
}

/** On Android, `lowPowerMode` is the system Battery Saver. */
export const expoBattery: Battery = {
  getState: read,
  subscribe(listener) {
    const refresh = () => void read().then(listener);
    const subscriptions = [
      ExpoBattery.addLowPowerModeListener(refresh),
      ExpoBattery.addBatteryLevelListener(refresh),
      ExpoBattery.addBatteryStateListener(refresh),
    ];
    return {
      remove() {
        for (const subscription of subscriptions) subscription.remove();
      },
    };
  },
};
