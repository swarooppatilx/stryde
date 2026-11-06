import type { ActivityType } from '@/types';
import type { ExportTrack } from '@/utils/exportTrack';

/** Seconds from the Unix epoch to the FIT epoch, 1989-12-31 00:00 UTC. */
export const FIT_EPOCH_S = 631_065_600;

type BaseName = 'enum' | 'sint8' | 'uint8' | 'sint16' | 'uint16' | 'sint32' | 'uint32' | 'uint8z';

const BASES: Record<BaseName, { id: number; size: number; invalid: number }> = {
  enum: { id: 0, size: 1, invalid: 0xff },
  sint8: { id: 1, size: 1, invalid: 0x7f },
  uint8: { id: 2, size: 1, invalid: 0xff },
  sint16: { id: 3, size: 2, invalid: 0x7fff },
  uint16: { id: 4, size: 2, invalid: 0xffff },
  sint32: { id: 5, size: 4, invalid: 0x7fffffff },
  uint32: { id: 6, size: 4, invalid: 0xffffffff },
  uint8z: { id: 10, size: 1, invalid: 0 },
};

export type FieldSpec = [num: number, base: BaseName];
/** A value, or null to write the field's invalid sentinel. */
export type FieldValue = number | null;

const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401,
  0x5000, 0x9c01, 0x8801, 0x4400,
] as const;

export function crc16(bytes: ArrayLike<number>): number {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
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

function put(base: BaseName, value: FieldValue, littleEndian: boolean): number[] {
  const { size, invalid } = BASES[base];
  const view = new DataView(new ArrayBuffer(size));
  const v = value ?? invalid;
  if (size === 1) view.setUint8(0, v & 0xff);
  else if (size === 2) view.setUint16(0, v & 0xffff, littleEndian);
  else view.setUint32(0, v >>> 0, littleEndian);
  return [...new Uint8Array(view.buffer)];
}

export interface Encoder {
  definition(local: number, global: number, fields: FieldSpec[], developerBytes?: number): number[];
  data(local: number, fields: FieldSpec[], values: FieldValue[], developer?: number[]): number[];
  compressed(local: number, offset: number, fields: FieldSpec[], values: FieldValue[]): number[];
}

export function encoder(littleEndian = true): Encoder {
  const u16 = (n: number) => (littleEndian ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff]);
  return {
    definition(local, global, fields, developerBytes) {
      const dev = developerBytes !== undefined;
      return [
        0x40 | (dev ? 0x20 : 0) | local,
        0,
        littleEndian ? 0 : 1,
        ...u16(global),
        fields.length,
        ...fields.flatMap(([num, base]) => [num, BASES[base].size, BASES[base].id]),
        ...(dev ? [1, 0, developerBytes, 0] : []),
      ];
    },
    data(local, fields, values, developer = []) {
      return [
        local,
        ...fields.flatMap(([, base], i) => put(base, values[i] ?? null, littleEndian)),
        ...developer,
      ];
    },
    compressed(local, offset, fields, values) {
      return [
        0x80 | (local << 5) | offset,
        ...fields.flatMap(([, base], i) => put(base, values[i] ?? null, littleEndian)),
      ];
    },
  };
}

/** Wraps message bytes in a FIT file: 14-byte header with its own CRC, then the data CRC. */
export function fitFile(body: readonly number[], headerSize: 12 | 14 = 14): Uint8Array {
  const header = [
    headerSize,
    0x20,
    0x00,
    0x08,
    body.length & 0xff,
    (body.length >> 8) & 0xff,
    (body.length >> 16) & 0xff,
    (body.length >>> 24) & 0xff,
    0x2e,
    0x46,
    0x49,
    0x54,
  ];
  if (headerSize === 14) {
    const headerCrc = crc16(header);
    header.push(headerCrc & 0xff, headerCrc >> 8);
  }
  const content = [...header, ...body];
  const crc = crc16(content);
  return Uint8Array.from([...content, crc & 0xff, crc >> 8]);
}

const MSG_FILE_ID = 0;
const MSG_SESSION = 18;
const MSG_LAP = 19;
const MSG_RECORD = 20;
const MSG_ACTIVITY = 34;

const FILE_ID: FieldSpec[] = [
  [0, 'enum'],
  [1, 'uint16'],
  [4, 'uint32'],
];
const RECORD: FieldSpec[] = [
  [253, 'uint32'],
  [0, 'sint32'],
  [1, 'sint32'],
  [2, 'uint16'],
  [3, 'uint8'],
  [4, 'uint8'],
  [5, 'uint32'],
];
const LAP: FieldSpec[] = [
  [253, 'uint32'],
  [2, 'uint32'],
  [7, 'uint32'],
  [8, 'uint32'],
  [9, 'uint32'],
];
const SESSION: FieldSpec[] = [
  [253, 'uint32'],
  [2, 'uint32'],
  [5, 'enum'],
  [6, 'enum'],
  [7, 'uint32'],
  [8, 'uint32'],
  [9, 'uint32'],
  [16, 'uint8'],
  [17, 'uint8'],
];
const ACTIVITY: FieldSpec[] = [
  [253, 'uint32'],
  [0, 'uint32'],
  [1, 'uint16'],
  [2, 'enum'],
];

const FIT_SPORT: Record<ActivityType, number> = {
  run: 1,
  ride: 2,
  swim: 5,
  walk: 11,
  hike: 17,
  row: 15,
  skate: 30,
  climb: 31,
  workout: 10,
  hiit: 10,
  dance: 10,
  yoga: 10,
};

const SEMICIRCLES = 2 ** 31 / 180;
const MANUFACTURER_DEVELOPMENT = 255;
const FILE_TYPE_ACTIVITY = 4;

const fitSeconds = (ms: number) => Math.max(0, Math.round(ms / 1000) - FIT_EPOCH_S);
const semicircles = (degrees: number) => Math.round(degrees * SEMICIRCLES);
const bounded = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(value)));

/** A FIT activity file: file id, one record per route point, the laps, a session and the activity. */
export function exportFit(track: ExportTrack): Uint8Array {
  const e = encoder(true);
  const start = fitSeconds(track.startedAt);
  const stop = fitSeconds(track.startedAt + track.totalTimeMs);
  const sport = FIT_SPORT[track.sport];
  const heartRates = track.points.flatMap((p) => (p.heartRate ? [p.heartRate] : []));

  const body: number[] = [
    ...e.definition(0, MSG_FILE_ID, FILE_ID),
    ...e.data(0, FILE_ID, [FILE_TYPE_ACTIVITY, MANUFACTURER_DEVELOPMENT, start]),
    ...e.definition(1, MSG_RECORD, RECORD),
  ];

  for (const p of track.points) {
    body.push(
      ...e.data(1, RECORD, [
        p.timestamp === undefined ? null : fitSeconds(p.timestamp),
        semicircles(p.latitude),
        semicircles(p.longitude),
        p.altitude === undefined ? null : bounded((p.altitude + 500) * 5, 0xfffe),
        p.heartRate === undefined ? null : bounded(p.heartRate, 0xfe),
        p.cadence === undefined ? null : bounded(p.cadence, 0xfe),
        bounded(p.distance * 100, 0xfffffffe),
      ])
    );
  }

  body.push(...e.definition(2, MSG_LAP, LAP));
  let lapStart = track.startedAt;
  for (const lap of track.laps ?? []) {
    const lapEnd = lapStart + lap.duration;
    body.push(
      ...e.data(2, LAP, [
        fitSeconds(lapEnd),
        fitSeconds(lapStart),
        lap.duration,
        lap.duration,
        bounded(lap.distance * 100, 0xfffffffe),
      ])
    );
    lapStart = lapEnd;
  }
  if (!track.laps || track.laps.length === 0) {
    body.push(
      ...e.data(2, LAP, [
        stop,
        start,
        track.totalTimeMs,
        track.totalTimeMs,
        bounded(track.totalDistanceM * 100, 0xfffffffe),
      ])
    );
  }

  const average =
    heartRates.length > 0 ? heartRates.reduce((a, b) => a + b, 0) / heartRates.length : null;
  body.push(
    ...e.definition(3, MSG_SESSION, SESSION),
    ...e.data(3, SESSION, [
      stop,
      start,
      sport,
      0,
      track.totalTimeMs,
      track.totalTimeMs,
      bounded(track.totalDistanceM * 100, 0xfffffffe),
      average === null ? null : bounded(average, 0xfe),
      heartRates.length > 0 ? bounded(Math.max(...heartRates), 0xfe) : null,
    ]),
    ...e.definition(4, MSG_ACTIVITY, ACTIVITY),
    ...e.data(4, ACTIVITY, [stop, track.totalTimeMs, 1, 0])
  );

  return fitFile(body);
}
