import type { ActivityType, Lap } from '@/types';
import type { ImportedTrack, TrackPoint, TrackSummary } from '@/utils/importTrack';

export type FitParse =
  | { ok: true; track: ImportedTrack }
  | { ok: false; reason: 'corrupt' | 'unreadable' };

/** Seconds from the Unix epoch to the FIT epoch, 1989-12-31 00:00 UTC. */
const FIT_EPOCH_S = 631_065_600;
const MAX_POINTS = 100_000;
const SEMICIRCLES_TO_DEGREES = 180 / 2 ** 31;

const MSG_SESSION = 18;
const MSG_LAP = 19;
const MSG_RECORD = 20;
const FIELD_TIMESTAMP = 253;

class FitCorrupt extends Error {}

interface Base {
  size: number;
  read: (view: DataView, at: number, littleEndian: boolean) => number;
  invalid: number;
}

/** The scalar base types by id; strings, 64-bit and floating point types are never read as numbers. */
const BASES: Record<number, Base> = {
  0: { size: 1, read: (v, a) => v.getUint8(a), invalid: 0xff },
  1: { size: 1, read: (v, a) => v.getInt8(a), invalid: 0x7f },
  2: { size: 1, read: (v, a) => v.getUint8(a), invalid: 0xff },
  3: { size: 2, read: (v, a, le) => v.getInt16(a, le), invalid: 0x7fff },
  4: { size: 2, read: (v, a, le) => v.getUint16(a, le), invalid: 0xffff },
  5: { size: 4, read: (v, a, le) => v.getInt32(a, le), invalid: 0x7fffffff },
  6: { size: 4, read: (v, a, le) => v.getUint32(a, le), invalid: 0xffffffff },
  10: { size: 1, read: (v, a) => v.getUint8(a), invalid: 0 },
  11: { size: 2, read: (v, a, le) => v.getUint16(a, le), invalid: 0 },
  12: { size: 4, read: (v, a, le) => v.getUint32(a, le), invalid: 0 },
  13: { size: 1, read: (v, a) => v.getUint8(a), invalid: 0xff },
};

interface FieldDef {
  num: number;
  size: number;
  baseId: number;
}

interface Definition {
  littleEndian: boolean;
  global: number;
  fields: FieldDef[];
  developerSize: number;
}

type Fields = Map<number, number>;

const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401,
  0x5000, 0x9c01, 0x8801, 0x4400,
] as const;

function crc16(bytes: Uint8Array, end: number): number {
  let crc = 0;
  for (let i = 0; i < end; i++) {
    const byte = bytes[i] as number;
    crc =
      ((crc >> 4) & 0x0fff) ^ (CRC_TABLE[crc & 0xf] as number) ^ (CRC_TABLE[byte & 0xf] as number);
    crc =
      ((crc >> 4) & 0x0fff) ^
      (CRC_TABLE[crc & 0xf] as number) ^
      (CRC_TABLE[(byte >> 4) & 0xf] as number);
  }
  return crc;
}

/** The first value of a field, or undefined when it holds the type's invalid marker. */
function readField(view: DataView, at: number, field: FieldDef, littleEndian: boolean) {
  const base = BASES[field.baseId & 0x1f];
  if (!base || field.size < base.size) return undefined;
  const value = base.read(view, at, littleEndian);
  return value === base.invalid ? undefined : value;
}

/** A definition message whose header byte was just read at `pos - 1`. */
function readDefinition(bytes: Uint8Array, at: number, end: number, header: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = at;
  const need = (length: number) => {
    if (pos + length > end) throw new FitCorrupt('Truncated definition');
  };
  need(5);
  const littleEndian = bytes[pos + 1] === 0;
  const global = view.getUint16(pos + 2, littleEndian);
  const count = bytes[pos + 4] as number;
  pos += 5;
  need(count * 3);
  const fields: FieldDef[] = [];
  for (let i = 0; i < count; i++) {
    fields.push({
      num: bytes[pos] as number,
      size: bytes[pos + 1] as number,
      baseId: bytes[pos + 2] as number,
    });
    pos += 3;
  }
  let developerSize = 0;
  if ((header & 0x20) !== 0) {
    need(1);
    const developerCount = bytes[pos++] as number;
    need(developerCount * 3);
    for (let i = 0; i < developerCount; i++) developerSize += bytes[pos + i * 3 + 1] as number;
    pos += developerCount * 3;
  }
  const definition: Definition = { littleEndian, global, fields, developerSize };
  return { definition, next: pos };
}

/** Every message in the file's data section, handed over as it is read. */
function readMessages(
  bytes: Uint8Array,
  start: number,
  end: number,
  onMessage: (global: number, fields: Fields) => void
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const definitions = new Map<number, Definition>();
  let pos = start;
  let lastTimestamp = 0;

  const need = (length: number) => {
    if (pos + length > end) throw new FitCorrupt('Truncated message');
  };

  while (pos < end) {
    const header = bytes[pos++] as number;

    if ((header & 0x80) === 0 && (header & 0x40) !== 0) {
      const { definition, next } = readDefinition(bytes, pos, end, header);
      definitions.set(header & 0x0f, definition);
      pos = next;
      continue;
    }

    const compressed = (header & 0x80) !== 0;
    const definition = definitions.get(compressed ? (header >> 5) & 0x03 : header & 0x0f);
    if (!definition) throw new FitCorrupt('Data before its definition');

    const fields: Fields = new Map();
    for (const field of definition.fields) {
      need(field.size);
      const value = readField(view, pos, field, definition.littleEndian);
      if (value !== undefined) fields.set(field.num, value);
      pos += field.size;
    }
    need(definition.developerSize);
    pos += definition.developerSize;

    if (compressed) {
      const offset = header & 0x1f;
      const base = lastTimestamp - (lastTimestamp % 32);
      lastTimestamp = base + offset + (offset < lastTimestamp % 32 ? 32 : 0);
      fields.set(FIELD_TIMESTAMP, lastTimestamp);
    } else {
      const stamp = fields.get(FIELD_TIMESTAMP);
      if (stamp !== undefined && stamp >= 0x10000000) lastTimestamp = stamp;
    }
    onMessage(definition.global, fields);
  }
}

const toMs = (fitSeconds: number) => (fitSeconds + FIT_EPOCH_S) * 1000;

/** The sport a FIT sport and sub-sport pair names; anything unfamiliar is a general workout. */
function sportOf(sport: number | undefined, sub: number | undefined): ActivityType {
  switch (sport) {
    case 1:
      return 'run';
    case 2:
    case 21:
      return 'ride';
    case 5:
      return 'swim';
    case 11:
      return 'walk';
    case 16:
    case 17:
    case 35:
      return 'hike';
    case 15:
    case 19:
    case 37:
    case 41:
    case 42:
      return 'row';
    case 30:
    case 33:
      return 'skate';
    case 31:
    case 48:
      return 'climb';
    case 4:
      switch (sub) {
        case 1:
          return 'run';
        case 5:
        case 6:
          return 'ride';
        case 14:
          return 'row';
        case 27:
          return 'walk';
        default:
          return 'workout';
      }
    default:
      return 'workout';
  }
}

interface RecordSample {
  timestamp?: number;
  point?: TrackPoint;
  distanceM?: number;
}

function sampleOf(fields: Fields): RecordSample {
  const sample: RecordSample = {};
  const stamp = fields.get(FIELD_TIMESTAMP);
  if (stamp !== undefined) sample.timestamp = toMs(stamp);
  const distance = fields.get(5);
  if (distance !== undefined) sample.distanceM = distance / 100;

  const lat = fields.get(0);
  const lon = fields.get(1);
  if (lat === undefined || lon === undefined) return sample;
  const latitude = lat * SEMICIRCLES_TO_DEGREES;
  const longitude = lon * SEMICIRCLES_TO_DEGREES;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return sample;

  const point: TrackPoint = { latitude, longitude };
  const enhanced = fields.get(78);
  const plain = fields.get(2);
  const altitude = enhanced ?? plain;
  if (altitude !== undefined) point.altitude = altitude / 5 - 500;
  if (sample.timestamp !== undefined) point.timestamp = sample.timestamp;
  const heart = fields.get(3);
  if (heart !== undefined && heart > 0) point.heartRate = heart;
  const cadence = fields.get(4);
  if (cadence !== undefined && cadence > 0) point.cadence = cadence;
  sample.point = point;
  return sample;
}

function summaryOf(
  session: Fields | undefined,
  samples: readonly RecordSample[]
): TrackSummary | null {
  const first = samples.find((s) => s.timestamp !== undefined)?.timestamp;
  const last = samples.findLast((s) => s.timestamp !== undefined)?.timestamp;
  const sessionStart = session?.get(2);
  const startTime = sessionStart === undefined ? first : toMs(sessionStart);
  const timer = session?.get(8) ?? session?.get(7);
  const spanMs = first !== undefined && last !== undefined ? last - first : 0;
  const durationMs = timer ?? spanMs;
  if (startTime === undefined || durationMs <= 0) return null;

  const total = session?.get(9);
  const distanceM =
    total === undefined
      ? (samples.findLast((s) => s.distanceM !== undefined)?.distanceM ?? 0)
      : total / 100;
  const avg = session?.get(16);
  const max = session?.get(17);
  return {
    startTime,
    durationMs,
    distanceM,
    ...(avg !== undefined && max !== undefined && { heartRate: { avg, max } }),
  };
}

/**
 * The activity in a FIT file, as the same track a GPX or TCX file gives. Without GPS (indoor) the
 * track has no points and carries the session's totals instead. Cadence is as the file gives it.
 */
export function trackFromFit(bytes: Uint8Array): FitParse {
  if (bytes.length < 12) return { ok: false, reason: 'unreadable' };
  const headerSize = bytes[0] as number;
  const signature = String.fromCharCode(
    bytes[8] ?? 0,
    bytes[9] ?? 0,
    bytes[10] ?? 0,
    bytes[11] ?? 0
  );
  if ((headerSize !== 12 && headerSize !== 14) || signature !== '.FIT') {
    return { ok: false, reason: 'unreadable' };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dataEnd = headerSize + view.getUint32(4, true);
  if (bytes.length < dataEnd + 2) return { ok: false, reason: 'corrupt' };
  if (view.getUint16(dataEnd, true) !== crc16(bytes, dataEnd)) {
    return { ok: false, reason: 'corrupt' };
  }
  if (headerSize === 14) {
    const headerCrc = view.getUint16(12, true);
    if (headerCrc !== 0 && headerCrc !== crc16(bytes, 12)) return { ok: false, reason: 'corrupt' };
  }

  const samples: RecordSample[] = [];
  const laps: Lap[] = [];
  let session: Fields | undefined;
  try {
    readMessages(bytes, headerSize, dataEnd, (global, fields) => {
      if (global === MSG_RECORD && samples.length < MAX_POINTS) samples.push(sampleOf(fields));
      else if (global === MSG_SESSION && !session) session = fields;
      else if (global === MSG_LAP) {
        const timer = fields.get(8) ?? fields.get(7);
        const distance = fields.get(9);
        if (timer !== undefined && distance !== undefined) {
          laps.push({ index: laps.length + 1, distance: distance / 100, duration: timer });
        }
      }
    });
  } catch (error) {
    if (error instanceof FitCorrupt) return { ok: false, reason: 'corrupt' };
    throw error;
  }

  const sport = sportOf(session?.get(5), session?.get(6));
  const points = samples.flatMap((s) => (s.point ? [s.point] : []));
  const lapField = laps.length > 0 && { laps };

  if (points.length >= 2) return { ok: true, track: { sport, points, ...lapField } };

  const summary = summaryOf(session, samples);
  if (!summary) return { ok: false, reason: 'unreadable' };
  return { ok: true, track: { sport, points: [], summary, ...lapField } };
}
