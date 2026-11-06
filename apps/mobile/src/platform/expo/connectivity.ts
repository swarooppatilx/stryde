import * as Network from 'expo-network';
import type { Connectivity } from '@/platform/ports';
import { logger } from '@/utils/logger';

function isOnline(state: Network.NetworkState): boolean {
  return (
    state.isConnected !== false &&
    state.isInternetReachable !== false &&
    state.type !== Network.NetworkStateType.NONE
  );
}

async function readOnline(): Promise<boolean> {
  try {
    return isOnline(await Network.getNetworkStateAsync());
  } catch (error) {
    logger.warn('[Device] Network state unreadable, assuming online', error);
    // An unreadable network state shouldn't park every write in the offline queue.
    return true;
  }
}

export const expoConnectivity: Connectivity = {
  isOnline: readOnline,

  subscribe(onChange) {
    return Network.addNetworkStateListener((state) => {
      if (isOnline(state)) {
        onChange(true);
        return;
      }
      // Events also fire for secondary networks (a phone's IMS/VoLTE link, for one), which never
      // reach the internet. Only the default network's state says whether the device is offline.
      void readOnline().then(onChange);
    });
  },
};
