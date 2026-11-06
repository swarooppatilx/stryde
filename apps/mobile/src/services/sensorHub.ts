import { lazyService } from '@/platform';
import type {
  BleConnection,
  BleNotification,
  BleSensors,
  Clock,
  SensorKind,
  WatchSample,
} from '@/platform/ports';
import { type PairedSensor, useSensorStore, wheelMmFor } from '@/stores/sensorStore';
import {
  advanceRevolutions,
  parseCscMeasurement,
  parseCyclingPower,
  parseHeartRate,
  type RevolutionData,
  type RevolutionState,
} from '@/utils/bleParsers';
import { logger } from '@/utils/logger';
import {
  type LatestReadings,
  type LiveSensors,
  liveSensors,
  type ReadingField,
  reconnectDelay,
  type SensorLink,
} from '@/utils/sensorLive';

/** Readings outside these are sensor glitches. */
const MIN_BPM = 30;
const MAX_BPM = 240;
const MAX_WATTS = 3000;
/** Bluetooth sensors notify about once a second; a recording keeps no more than that per kind. */
const SAMPLE_EVERY_MS = 900;
const MAX_CRANK_RATE = 5;

export interface SensorHubSnapshot {
  links: readonly SensorLink[];
  latest: LatestReadings;
}

interface Deps {
  ble: BleSensors;
  clock: Clock;
  /** Wheel size in mm, read each time a wheel reading arrives. */
  wheelMm(): number;
  /** Called when a sensor connects, so its pairing can note it was just seen. */
  onSeen?(id: string): void;
}

interface Link {
  info: SensorLink;
  connection: BleConnection | null;
  attempts: number;
  timer: ReturnType<typeof setTimeout> | null;
  pending: Promise<boolean> | null;
  closed: boolean;
  rev: Map<string, RevolutionState>;
}

/**
 * The Bluetooth sensors the app is connected to. Notifications only update a few numbers and never
 * touch the GPS path; while a recording is running a dropped sensor is reconnected with growing waits.
 */
export function createSensorHub({ ble, clock, wheelMm, onSeen }: Deps) {
  const links = new Map<string, Link>();
  const listeners = new Set<() => void>();
  let latest: LatestReadings = {};
  let snapshot: SensorHubSnapshot = { links: [], latest };
  let keepAlive = false;
  let collecting = false;
  let samples: WatchSample[] = [];
  const lastSampleAt: Partial<Record<SensorKind, number>> = {};

  function emit(): void {
    snapshot = { links: [...links.values()].map((l) => l.info), latest };
    for (const listener of [...listeners]) listener();
  }

  function setInfo(link: Link, patch: Partial<SensorLink>): void {
    link.info = { ...link.info, ...patch };
    emit();
  }

  function rate(link: Link, key: string, data: RevolutionData, wheel: boolean): number | null {
    const next = advanceRevolutions(link.rev.get(key) ?? null, data, clock.now(), {
      revBits: wheel ? 32 : 16,
      timeHz: 1024,
      ...(wheel ? {} : { maxRate: MAX_CRANK_RATE }),
    });
    link.rev.set(key, next.state);
    return next.rate;
  }

  type Fields = Partial<Record<ReadingField, number>>;

  function heartRateFields(value: Uint8Array): Fields | null {
    const reading = parseHeartRate(value);
    if (!reading || reading.contact === 'lost') return null;
    if (reading.bpm < MIN_BPM || reading.bpm > MAX_BPM) return null;
    return { heartRate: reading.bpm };
  }

  function powerFields(link: Link, value: Uint8Array): Fields | null {
    const reading = parseCyclingPower(value);
    if (!reading) return null;
    const fields: Fields = {};
    if (reading.power >= 0 && reading.power <= MAX_WATTS) fields.power = reading.power;
    const crank = reading.crank ? rate(link, 'crank', reading.crank, false) : null;
    if (crank !== null) fields.cadence = Math.round(crank * 60);
    return fields;
  }

  function speedCadenceFields(link: Link, value: Uint8Array): Fields | null {
    const reading = parseCscMeasurement(value);
    if (!reading) return null;
    const fields: Fields = {};
    const wheel = reading.wheel ? rate(link, 'wheel', reading.wheel, true) : null;
    if (wheel !== null) fields.speed = (wheel * wheelMm()) / 1000;
    const crank = reading.crank ? rate(link, 'crank', reading.crank, false) : null;
    if (crank !== null) fields.cadence = Math.round(crank * 60);
    return fields;
  }

  function handle(link: Link, { kind, value }: BleNotification): void {
    const now = clock.now();
    const fields = {
      heartRate: () => heartRateFields(value),
      power: () => powerFields(link, value),
      speedCadence: () => speedCadenceFields(link, value),
    }[kind]();
    if (!fields) return;
    for (const field of Object.keys(fields) as ReadingField[]) {
      const reading = fields[field];
      if (reading !== undefined) latest = { ...latest, [field]: { value: reading, at: now } };
    }
    const last = lastSampleAt[kind];
    const due = last === undefined || now - last >= SAMPLE_EVERY_MS;
    if (collecting && due && Object.keys(fields).length > 0) {
      lastSampleAt[kind] = now;
      samples.push({ t: now, ...fields });
    }
    emit();
  }

  function schedule(link: Link): void {
    const delay = reconnectDelay(link.attempts);
    if (delay === null) {
      setInfo(link, { status: 'lost' });
      return;
    }
    setInfo(link, { status: 'reconnecting' });
    link.timer = setTimeout(() => {
      link.timer = null;
      if (link.closed) return;
      link.attempts += 1;
      void open(link, true);
    }, delay);
  }

  function dropped(link: Link): void {
    link.connection = null;
    if (link.closed) return;
    if (keepAlive) {
      link.attempts = 0;
      schedule(link);
    } else {
      setInfo(link, { status: 'lost' });
    }
  }

  async function open(link: Link, reconnecting: boolean): Promise<boolean> {
    if (!reconnecting) setInfo(link, { status: 'connecting' });
    try {
      const connection = await ble.connect(link.info.id, link.info.kinds, {
        onNotification: (n) => handle(link, n),
        onDisconnect: () => dropped(link),
      });
      if (link.closed) {
        await connection.disconnect().catch(() => undefined);
        return false;
      }
      link.connection = connection;
      link.attempts = 0;
      setInfo(link, { status: 'connected', everConnected: true });
      onSeen?.(link.info.id);
      return true;
    } catch (error) {
      if (link.closed) return false;
      logger.info('[Sensors] Could not connect', error);
      if (keepAlive) {
        schedule(link);
      } else {
        links.delete(link.info.id);
        emit();
      }
      return false;
    }
  }

  async function close(link: Link): Promise<void> {
    link.closed = true;
    if (link.timer) clearTimeout(link.timer);
    link.timer = null;
    links.delete(link.info.id);
    const connection = link.connection;
    link.connection = null;
    emit();
    await connection?.disconnect().catch(() => undefined);
  }

  return {
    getSnapshot: (): SensorHubSnapshot => snapshot,

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** What the recording shows now: fresh readings only, plus which sensors dropped out. */
    live: (now: number): LiveSensors => liveSensors(latest, snapshot.links, now),

    /** Resolves true once connected; false when the sensor could not be reached. */
    async connect(device: {
      id: string;
      name: string;
      kinds: readonly SensorKind[];
    }): Promise<boolean> {
      const existing = links.get(device.id);
      const covers = existing && device.kinds.every((kind) => existing.info.kinds.includes(kind));
      if (existing && covers && existing.info.status !== 'lost') {
        return existing.pending ?? Promise.resolve(existing.info.status === 'connected');
      }
      if (existing) await close(existing);
      const link: Link = {
        info: {
          id: device.id,
          name: device.name,
          kinds: [...device.kinds],
          status: 'connecting',
          everConnected: false,
        },
        connection: null,
        attempts: 0,
        timer: null,
        pending: null,
        closed: false,
        rev: new Map(),
      };
      links.set(device.id, link);
      link.pending = open(link, false).finally(() => {
        link.pending = null;
      });
      return await link.pending;
    },

    /** Connects the paired sensors, a device paired for several kinds once with all of them. */
    async connectPaired(paired: readonly PairedSensor[]): Promise<void> {
      const byId = new Map<string, { name: string; kinds: SensorKind[] }>();
      for (const sensor of paired) {
        const entry = byId.get(sensor.id) ?? { name: sensor.name, kinds: [] };
        entry.kinds.push(sensor.kind);
        byId.set(sensor.id, entry);
      }
      await Promise.all(
        [...byId].map(([id, { name, kinds }]) => this.connect({ id, name, kinds }))
      );
    },

    async disconnect(id: string): Promise<void> {
      const link = links.get(id);
      if (link) await close(link);
    },

    /** From here a dropped sensor is reconnected, and its readings are kept for the activity. */
    beginRecording(): void {
      keepAlive = true;
      collecting = true;
      samples = [];
      for (const kind of Object.keys(lastSampleAt) as SensorKind[]) delete lastSampleAt[kind];
    },

    /** Readings are kept only while the recording runs, not while it is paused. */
    setCollecting(on: boolean): void {
      collecting = on && keepAlive;
    },

    /** Stops retrying and lets go of every sensor; the readings stay until `clearSamples`. */
    async endRecording(): Promise<void> {
      keepAlive = false;
      collecting = false;
      await Promise.all([...links.values()].map(close));
    },

    samples: (): readonly WatchSample[] => samples,

    clearSamples(): void {
      samples = [];
    },
  };
}

export type SensorHub = ReturnType<typeof createSensorHub>;

/** The app-wide hub, built on first use from the installed platform. */
export const sensorHub: SensorHub = lazyService((platform) =>
  createSensorHub({
    ble: platform.ble,
    clock: platform.clock,
    wheelMm: () => wheelMmFor(useSensorStore.getState(), undefined),
    onSeen: (id) => useSensorStore.getState().touch(id, platform.clock.now()),
  })
);
