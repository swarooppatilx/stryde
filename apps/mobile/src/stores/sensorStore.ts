import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SensorKind } from '@/platform/ports';
import { chainScopedStorageAdapter } from '@/utils/storage';

export interface PairedSensor {
  id: string;
  name: string;
  kind: SensorKind;
  /** When it was last in range, ms since 1970. */
  lastSeen: number;
}

/** A 700x25c road tyre, the usual starting point. */
export const DEFAULT_WHEEL_MM = 2105;
const MIN_WHEEL_MM = 1000;
const MAX_WHEEL_MM = 2600;

export function clampWheelMm(mm: number): number {
  if (!Number.isFinite(mm)) return DEFAULT_WHEEL_MM;
  return Math.min(MAX_WHEEL_MM, Math.max(MIN_WHEEL_MM, Math.round(mm)));
}

type PairedByKind = Record<SensorKind, PairedSensor | null>;

interface SensorState {
  /** One sensor per kind: only one source feeds heart rate, power or speed and cadence. */
  paired: PairedByKind;
  /** Connect the paired sensors when a recording starts. */
  autoConnect: boolean;
  /** Wheel size (mm round the tyre) used to turn wheel revolutions into speed. */
  defaultWheelMm: number;
  wheelMmByBike: Record<string, number>;
  pair: (kind: SensorKind, device: { id: string; name: string }, now: number) => void;
  forget: (kind: SensorKind) => void;
  /** Marks every pairing of this device as just seen. */
  touch: (id: string, now: number) => void;
  setAutoConnect: (on: boolean) => void;
  setDefaultWheelMm: (mm: number) => void;
  /** `null` removes the bike's own size. */
  setBikeWheelMm: (bikeId: string, mm: number | null) => void;
  reset: () => void;
}

const emptyPaired = (): PairedByKind => ({ heartRate: null, power: null, speedCadence: null });

const defaults = () => ({
  paired: emptyPaired(),
  autoConnect: true,
  defaultWheelMm: DEFAULT_WHEEL_MM,
  wheelMmByBike: {},
});

export const useSensorStore = create<SensorState>()(
  persist(
    (set) => ({
      ...defaults(),
      pair: (kind, device, now) =>
        set((s) => ({
          paired: {
            ...s.paired,
            [kind]: { id: device.id, name: device.name, kind, lastSeen: now },
          },
        })),
      forget: (kind) => set((s) => ({ paired: { ...s.paired, [kind]: null } })),
      touch: (id, now) =>
        set((s) => {
          const paired = { ...s.paired };
          for (const sensor of Object.values(paired)) {
            if (sensor?.id === id) paired[sensor.kind] = { ...sensor, lastSeen: now };
          }
          return { paired };
        }),
      setAutoConnect: (autoConnect) => set({ autoConnect }),
      setDefaultWheelMm: (mm) => set({ defaultWheelMm: clampWheelMm(mm) }),
      setBikeWheelMm: (bikeId, mm) =>
        set((s) => {
          const { [bikeId]: _removed, ...rest } = s.wheelMmByBike;
          return { wheelMmByBike: mm === null ? rest : { ...rest, [bikeId]: clampWheelMm(mm) } };
        }),
      reset: () => set({ ...defaults() }),
    }),
    {
      name: '@stryde/sensors',
      version: 1,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);

/** The wheel size for a bike, or the default when it has none of its own. */
export function wheelMmFor(
  state: Pick<SensorState, 'defaultWheelMm' | 'wheelMmByBike'>,
  bikeId: string | undefined
): number {
  return (bikeId ? state.wheelMmByBike[bikeId] : undefined) ?? state.defaultWheelMm;
}
