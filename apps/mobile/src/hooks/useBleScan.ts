import { useEffect, useState } from 'react';
import { getPlatform } from '@/platform';
import type { BleDevice } from '@/platform/ports';

const FLUSH_MS = 700;
/** A sensor not heard from for this long has gone out of range or been switched off. */
const FORGET_AFTER_MS = 12_000;

/** Sensors nearby while `active`, strongest first by the screen; the list is refreshed twice a second at most. */
export function useBleScan(active: boolean): { devices: BleDevice[]; failed: boolean } {
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active) return;
    setFailed(false);
    const seen = new Map<string, { device: BleDevice; at: number }>();
    let dirty = false;
    const scan = getPlatform().ble.scan(
      (device) => {
        seen.set(device.id, { device, at: Date.now() });
        dirty = true;
      },
      () => setFailed(true)
    );
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [id, entry] of seen) {
        if (now - entry.at > FORGET_AFTER_MS) {
          seen.delete(id);
          dirty = true;
        }
      }
      if (!dirty) return;
      dirty = false;
      setDevices([...seen.values()].map((entry) => entry.device));
    }, FLUSH_MS);
    return () => {
      clearInterval(timer);
      scan.remove();
      setDevices([]);
    };
  }, [active]);

  return { devices, failed };
}
