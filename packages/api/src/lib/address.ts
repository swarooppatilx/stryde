export type Address = `0x${string}`;

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/** True for a 0x-prefixed 20-byte hex string, in any letter case. */
export function isAddress(value: unknown): value is Address {
  return typeof value === 'string' && ADDRESS_PATTERN.test(value);
}

/** The lowercase form of a wallet address, or null when the value is not one. */
export function toAddress(value: unknown): Address | null {
  return isAddress(value) ? (value.toLowerCase() as Address) : null;
}
