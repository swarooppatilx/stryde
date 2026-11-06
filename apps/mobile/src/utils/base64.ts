const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 with padding, for handing binary files to the cache writer. */
export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] as number;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    parts.push(
      ALPHABET.charAt((n >> 18) & 63),
      ALPHABET.charAt((n >> 12) & 63),
      b === undefined ? '=' : ALPHABET.charAt((n >> 6) & 63),
      c === undefined ? '=' : ALPHABET.charAt(n & 63)
    );
  }
  return parts.join('');
}
