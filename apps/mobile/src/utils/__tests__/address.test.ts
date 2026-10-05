import { describe, expect, it } from 'vitest';
import { sameAddress } from '@/utils/address';

describe('sameAddress', () => {
  it('matches a checksummed and a lowercased form of the same wallet', () => {
    expect(
      sameAddress(
        '0x9e743e5C7Ad9943b108D28Ee000216ad3F8844FE',
        '0x9e743e5c7ad9943b108d28ee000216ad3f8844fe'
      )
    ).toBe(true);
  });

  it('never matches a missing id', () => {
    expect(sameAddress(undefined, undefined)).toBe(false);
    expect(sameAddress('0xabc', undefined)).toBe(false);
  });
});
