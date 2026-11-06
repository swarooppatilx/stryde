import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getPlatform } from '@/platform';
import type { BleAdapterState } from '@/platform/ports';

/** Whether Bluetooth can be used now (null until known), and a way to ask for the permission. */
export function useBleAdapter() {
  const [state, setState] = useState<BleAdapterState | null>(null);

  useEffect(() => {
    const { ble } = getPlatform();
    const refresh = () => void ble.adapterState().then(setState);
    refresh();
    const adapter = ble.onAdapterState(setState);
    // Permission and Bluetooth are changed in the phone's settings: check again on the way back.
    const app = AppState.addEventListener('change', (next) => next === 'active' && refresh());
    return () => {
      adapter.remove();
      app.remove();
    };
  }, []);

  const request = useCallback(async () => {
    setState(await getPlatform().ble.requestPermission());
  }, []);

  return { state, request };
}
