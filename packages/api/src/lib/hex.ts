export type Bytes32 = `0x${string}`;

const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;

/** True for a 0x-prefixed 32-byte hex string (a hash or an id), in any letter case. */
export function isBytes32(value: unknown): value is Bytes32 {
  return typeof value === 'string' && BYTES32_PATTERN.test(value);
}
