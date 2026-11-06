import type {
  BleAdapterState,
  BleConnection,
  BleConnectionHandlers,
  BleDevice,
  BleNotification,
  BleSensors,
  SensorKind,
  Subscription,
} from '@/platform/ports';

/** Bluetooth sensors that tests drive by hand: advertise devices, push notifications, drop links. */
export class FakeBleSensors implements BleSensors {
  state: BleAdapterState = 'ready';
  /** What `requestPermission` turns an `unauthorized` state into. */
  stateAfterRequest: BleAdapterState = 'ready';
  /** Ids whose next `connect` attempts fail; a number is how many more attempts fail. */
  failConnects = new Map<string, number>();
  /** Every call, in order: 'scan', 'connect:id', 'disconnect:id'. */
  calls: string[] = [];
  private scanners = new Set<(device: BleDevice) => void>();
  private stateListeners = new Set<(state: BleAdapterState) => void>();
  private links = new Map<string, BleConnectionHandlers>();

  async adapterState() {
    return this.state;
  }

  onAdapterState(listener: (state: BleAdapterState) => void): Subscription {
    this.stateListeners.add(listener);
    return { remove: () => this.stateListeners.delete(listener) };
  }

  async requestPermission() {
    if (this.state === 'unauthorized') this.setState(this.stateAfterRequest);
    return this.state;
  }

  scan(onDevice: (device: BleDevice) => void): Subscription {
    this.calls.push('scan');
    this.scanners.add(onDevice);
    return { remove: () => this.scanners.delete(onDevice) };
  }

  async connect(id: string, _kinds: readonly SensorKind[], handlers: BleConnectionHandlers) {
    this.calls.push(`connect:${id}`);
    const failures = this.failConnects.get(id) ?? 0;
    if (failures > 0) {
      this.failConnects.set(id, failures - 1);
      throw new Error('connection failed');
    }
    this.links.set(id, handlers);
    const connection: BleConnection = {
      disconnect: async () => {
        this.calls.push(`disconnect:${id}`);
        this.links.delete(id);
      },
    };
    return connection;
  }

  setState(state: BleAdapterState): void {
    this.state = state;
    for (const listener of this.stateListeners) listener(state);
  }

  /** A sensor appearing in the scan. */
  advertise(device: BleDevice): void {
    for (const listener of this.scanners) listener(device);
  }

  isConnected(id: string): boolean {
    return this.links.has(id);
  }

  /** A measurement arriving from a connected sensor. */
  notify(id: string, notification: BleNotification): void {
    this.links.get(id)?.onNotification(notification);
  }

  /** The link to a sensor dropping (out of range, battery out). */
  drop(id: string): void {
    const handlers = this.links.get(id);
    this.links.delete(id);
    handlers?.onDisconnect();
  }
}

/** For phones without Bluetooth LE: always unsupported. */
export const noBle: BleSensors = {
  adapterState: async () => 'unsupported',
  onAdapterState: () => ({ remove: () => undefined }),
  requestPermission: async () => 'unsupported',
  scan: () => ({ remove: () => undefined }),
  connect: async () => {
    throw new Error('Bluetooth LE is not available');
  },
};
