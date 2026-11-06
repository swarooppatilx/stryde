import {
  crc16,
  encoder,
  FIT_EPOCH_S,
  type FieldSpec,
  type FieldValue,
  fitFile as writeFit,
} from '@/utils/exportFit';

export type { FieldSpec, FieldValue };
export { crc16, encoder, FIT_EPOCH_S };

export function fitFile(
  body: number[],
  options: { headerSize?: 12 | 14; corruptCrc?: boolean } = {}
): Uint8Array {
  const bytes = writeFit(body, options.headerSize ?? 14);
  if (options.corruptCrc) {
    bytes[bytes.length - 2] = (bytes[bytes.length - 2] as number) ^ 0x34;
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] as number) ^ 0x12;
  }
  return bytes;
}
