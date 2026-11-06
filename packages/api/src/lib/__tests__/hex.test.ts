import { describe, expect, it } from 'vitest';
import { isBytes32 } from '../hex.js';

describe('isBytes32', () => {
  const ok = `0x${'ab12'.repeat(16)}`;

  it('accepts a 0x-prefixed 32-byte hex string in either letter case', () => {
    expect(isBytes32(ok)).toBe(true);
    expect(isBytes32(ok.toUpperCase().replace('0X', '0x'))).toBe(true);
  });

  it('rejects the wrong length, a missing prefix, non-hex characters and non-strings', () => {
    expect(isBytes32(`0x${'a'.repeat(63)}`)).toBe(false);
    expect(isBytes32(`0x${'a'.repeat(65)}`)).toBe(false);
    expect(isBytes32('a'.repeat(64))).toBe(false);
    expect(isBytes32(`0x${'g'.repeat(64)}`)).toBe(false);
    expect(isBytes32(undefined)).toBe(false);
    expect(isBytes32(12)).toBe(false);
  });

  it('does not take a 20-byte address for a 32-byte id', () => {
    expect(isBytes32(`0x${'a'.repeat(40)}`)).toBe(false);
  });
});
