import { PermissionsAndroid, Platform } from 'react-native';
import { type BleError, BleManager, type Device, State } from 'react-native-ble-plx';
import { noBle } from '@/platform/fakes/ble';
import type {
  BleAdapterState,
  BleConnection,
  BleConnectionHandlers,
  BleDevice,
  BleSensors,
  SensorKind,
  Subscription,
} from '@/platform/ports';
import { decodeBase64 } from '@/utils/bleParsers';
import { logger } from '@/utils/logger';

const base = (short: string) => `0000${short}-0000-1000-8000-00805f9b34fb`;

const SERVICE: Record<SensorKind, string> = {
  heartRate: base('180d'),
  power: base('1818'),
  speedCadence: base('1816'),
};
const MEASUREMENT: Record<SensorKind, string> = {
  heartRate: base('2a37'),
  power: base('2a63'),
  speedCadence: base('2a5b'),
};
const KINDS = Object.keys(SERVICE) as SensorKind[];

const STATES: Partial<Record<State, BleAdapterState>> = {
  [State.PoweredOn]: 'ready',
  [State.PoweredOff]: 'off',
  [State.Unauthorized]: 'unauthorized',
  [State.Unsupported]: 'unsupported',
};

function permissionsNeeded() {
  const { PERMISSIONS } = PermissionsAndroid;
  if (Number(Platform.Version) >= 31) {
    return [PERMISSIONS.BLUETOOTH_SCAN, PERMISSIONS.BLUETOOTH_CONNECT];
  }
  return [PERMISSIONS.ACCESS_FINE_LOCATION];
}

async function permissionGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const checks = await Promise.all(permissionsNeeded().map((p) => PermissionsAndroid.check(p)));
  return checks.every(Boolean);
}

function kindsOf(device: Device): SensorKind[] {
  const advertised = (device.serviceUUIDs ?? []).map((uuid) => uuid.toLowerCase());
  return KINDS.filter((kind) => advertised.includes(SERVICE[kind]));
}

function createBleSensors(): BleSensors {
  let manager: BleManager | null = null;
  const get = () => {
    manager ??= new BleManager();
    return manager;
  };

  async function adapterState(): Promise<BleAdapterState> {
    if (Platform.OS === 'web') return 'unsupported';
    if (!(await permissionGranted())) return 'unauthorized';
    try {
      const state = await get().state();
      // Unknown and Resetting settle within moments; treating them as off is a harmless pause.
      return STATES[state] ?? 'off';
    } catch (error) {
      // A build without the native module cannot create the manager.
      logger.warn('[Ble] Bluetooth is not available', error);
      return 'unsupported';
    }
  }

  return {
    adapterState,

    onAdapterState(listener): Subscription {
      try {
        return get().onStateChange(async () => listener(await adapterState()), true);
      } catch {
        listener('unsupported');
        return { remove: () => undefined };
      }
    },

    async requestPermission() {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.requestMultiple(permissionsNeeded());
      }
      return adapterState();
    },

    scan(onDevice, onError): Subscription {
      let ble: BleManager;
      try {
        ble = get();
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
        return { remove: () => undefined };
      }
      ble
        .startDeviceScan(
          KINDS.map((kind) => SERVICE[kind]),
          { allowDuplicates: true },
          (error: BleError | null, device: Device | null) => {
            if (error) {
              onError(error);
              return;
            }
            if (!device) return;
            const kinds = kindsOf(device);
            if (kinds.length === 0) return;
            const found: BleDevice = {
              id: device.id,
              name: device.name ?? device.localName,
              kinds,
              rssi: device.rssi,
            };
            onDevice(found);
          }
        )
        .catch((error: unknown) =>
          onError(error instanceof Error ? error : new Error(String(error)))
        );
      return { remove: () => void ble.stopDeviceScan().catch(() => undefined) };
    },

    async connect(id, kinds, handlers: BleConnectionHandlers): Promise<BleConnection> {
      const ble = get();
      const device = await ble.connectToDevice(id, { timeout: 10_000 });
      const subs: Subscription[] = [];
      let closing = false;
      try {
        await device.discoverAllServicesAndCharacteristics();
        for (const kind of kinds) {
          subs.push(
            ble.monitorCharacteristicForDevice(id, SERVICE[kind], MEASUREMENT[kind], (error, c) => {
              if (error || !c?.value) return;
              handlers.onNotification({ kind, value: decodeBase64(c.value) });
            })
          );
        }
      } catch (error) {
        await ble.cancelDeviceConnection(id).catch(() => undefined);
        throw error;
      }
      subs.push(
        ble.onDeviceDisconnected(id, () => {
          for (const sub of subs) sub.remove();
          if (!closing) handlers.onDisconnect();
        })
      );
      return {
        async disconnect() {
          closing = true;
          for (const sub of subs) sub.remove();
          await ble.cancelDeviceConnection(id).catch((error: unknown) => {
            logger.warn('[Ble] Disconnect failed', error);
          });
        },
      };
    },
  };
}

/** Real Bluetooth LE through react-native-ble-plx; builds without the native module get no sensors. */
export const expoBleSensors: BleSensors = (() => {
  if (Platform.OS !== 'android') return noBle;
  return createBleSensors();
})();
