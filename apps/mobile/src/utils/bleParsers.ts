/** Decoders for the standard Bluetooth LE fitness characteristics (Heart Rate, Cycling Power, Cycling Speed and Cadence). */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** The bytes of a base64 characteristic value, as react-native-ble-plx delivers it. Stray characters are skipped. */
export function decodeBase64(text: string): Uint8Array {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of text) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) continue;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(out);
}

const u16 = (v: Uint8Array, at: number) => (v[at] ?? 0) | ((v[at + 1] ?? 0) << 8);
const i16 = (v: Uint8Array, at: number) => (u16(v, at) << 16) >> 16;
const u32 = (v: Uint8Array, at: number) => (u16(v, at) | (u16(v, at + 2) << 16)) >>> 0;

export type HeartRateContact = 'unsupported' | 'detected' | 'lost';

const CONTACT: Record<number, HeartRateContact> = { 3: 'detected', 2: 'lost' };

export interface HeartRateReading {
  bpm: number;
  contact: HeartRateContact;
  /** Beat-to-beat intervals in milliseconds, when the strap sends them. */
  rr: number[];
}

/** Heart Rate Measurement (0x2A37). Null when the value is shorter than its flags say. */
export function parseHeartRate(value: Uint8Array): HeartRateReading | null {
  const flags = value[0];
  if (flags === undefined) return null;
  const wide = (flags & 0x01) !== 0;
  let at = 1;
  if (value.length < at + (wide ? 2 : 1)) return null;
  const bpm = wide ? u16(value, at) : (value[at] ?? 0);
  at += wide ? 2 : 1;
  const contactBits = (flags >> 1) & 0x03;
  const contact = CONTACT[contactBits] ?? 'unsupported';
  if ((flags & 0x08) !== 0) at += 2;
  const rr: number[] = [];
  if ((flags & 0x10) !== 0) {
    for (; at + 2 <= value.length; at += 2) rr.push(Math.round((u16(value, at) * 1000) / 1024));
  }
  return { bpm, contact, rr };
}

/** A running count of revolutions and the time of the last one, in the sensor's own units. */
export interface RevolutionData {
  revs: number;
  time: number;
}

export interface CyclingPowerReading {
  /** Watts at this instant. */
  power: number;
  /** Share of the effort from the left pedal, percent. */
  balance?: number;
  crank?: RevolutionData;
}

/** Cycling Power Measurement (0x2A63). Null when the value is shorter than its flags say. */
export function parseCyclingPower(value: Uint8Array): CyclingPowerReading | null {
  if (value.length < 4) return null;
  const flags = u16(value, 0);
  const reading: CyclingPowerReading = { power: i16(value, 2) };
  let at = 4;
  if ((flags & 0x01) !== 0) {
    if (value.length < at + 1) return null;
    reading.balance = (value[at] ?? 0) / 2;
    at += 1;
  }
  if ((flags & 0x04) !== 0) at += 2;
  if ((flags & 0x10) !== 0) at += 6;
  if ((flags & 0x20) !== 0) {
    if (value.length < at + 4) return null;
    reading.crank = { revs: u16(value, at), time: u16(value, at + 2) };
  }
  if (at > value.length) return null;
  return reading;
}

export interface CscReading {
  wheel?: RevolutionData;
  crank?: RevolutionData;
}

/** Cycling Speed and Cadence Measurement (0x2A5B). Null when the value is shorter than its flags say. */
export function parseCscMeasurement(value: Uint8Array): CscReading | null {
  const flags = value[0];
  if (flags === undefined) return null;
  const reading: CscReading = {};
  let at = 1;
  if ((flags & 0x01) !== 0) {
    if (value.length < at + 6) return null;
    reading.wheel = { revs: u32(value, at), time: u16(value, at + 4) };
    at += 6;
  }
  if ((flags & 0x02) !== 0) {
    if (value.length < at + 4) return null;
    reading.crank = { revs: u16(value, at), time: u16(value, at + 2) };
  }
  return reading;
}

export interface RevolutionState extends RevolutionData {
  /** When (ms) the counter last moved. */
  changedAt: number;
  /** Revolutions per second as of the last movement; 0 once it stopped. */
  rate: number | null;
}

interface RevolutionUnits {
  revBits: 16 | 32;
  /** Ticks per second of the event time. */
  timeHz: 1024 | 2048;
  /** Faster than this is a glitch, not a rider (revolutions per second). Defaults to 20. */
  maxRate?: number;
}

/** A counter that has not moved for this long means the wheel or crank stopped. */
export const REVOLUTION_STALE_MS = 2500;
const DEFAULT_MAX_RATE = 20;

/**
 * Folds one revolution reading into the previous state. The counter and the event time both wrap, so
 * the change is taken modulo their width. A sensor repeats its last event while nothing turns: that
 * holds the last rate for a moment and then reports 0.
 */
export function advanceRevolutions(
  prev: RevolutionState | null,
  cur: RevolutionData,
  now: number,
  units: RevolutionUnits
): { state: RevolutionState; rate: number | null } {
  const fresh: RevolutionState = { ...cur, changedAt: now, rate: null };
  if (!prev) return { state: fresh, rate: null };
  const revDelta =
    units.revBits === 32 ? (cur.revs - prev.revs) >>> 0 : (cur.revs - prev.revs) & 0xffff;
  const timeDelta = (cur.time - prev.time) & 0xffff;
  if (revDelta === 0) {
    const stopped = now - prev.changedAt > REVOLUTION_STALE_MS;
    const rate = stopped ? 0 : prev.rate;
    return { state: { ...prev, rate }, rate };
  }
  if (timeDelta === 0) return { state: prev, rate: prev.rate };
  const rate = revDelta / (timeDelta / units.timeHz);
  if (rate > (units.maxRate ?? DEFAULT_MAX_RATE)) return { state: fresh, rate: null };
  return { state: { ...cur, changedAt: now, rate }, rate };
}
