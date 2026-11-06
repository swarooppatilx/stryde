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

export function crc16(bytes: ArrayLike<number>): number {
  const table = [
    0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401,
    0x5000, 0x9c01, 0x8801, 0x4400,
  ] as const;
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] as number;
    let tmp = table[crc & 0xf] as number;
    crc = ((crc >> 4) & 0x0fff) ^ tmp ^ (table[byte & 0xf] as number);
    tmp = table[crc & 0xf] as number;
    crc = ((crc >> 4) & 0x0fff) ^ tmp ^ (table[(byte >> 4) & 0xf] as number);
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

export function fitFile(
  body: number[],
  options: { headerSize?: 12 | 14; corruptCrc?: boolean } = {}
): Uint8Array {
  const headerSize = options.headerSize ?? 14;
  const header = [
    headerSize,
    0x20,
    0x00,
    0x08,
    body.length & 0xff,
    (body.length >> 8) & 0xff,
    (body.length >> 16) & 0xff,
    (body.length >> 24) & 0xff,
    0x2e,
    0x46,
    0x49,
    0x54,
  ];
  if (headerSize === 14) {
    const crc = crc16(header);
    header.push(crc & 0xff, crc >> 8);
  }
  const content = [...header, ...body];
  const crc = crc16(content) ^ (options.corruptCrc ? 0x1234 : 0);
  return Uint8Array.from([...content, crc & 0xff, crc >> 8]);
}
