import { describe, expect, it } from 'vitest';
import { sameAddress, shortAddress, viewerAddress } from '@/utils/address';

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

describe('viewerAddress', () => {
  const ME = '0x00000000000000000000000000000000000000aa';
  const WALLET = '0x00000000000000000000000000000000000000bb';

  it('is the signed-in identity when there is one, so what you own does not hinge on the wallet having started', () => {
    expect(viewerAddress(ME, undefined)).toBe(ME);
    expect(viewerAddress(ME, WALLET)).toBe(ME);
  });

  it('falls back to the wallet address when the identity is the signed-out placeholder', () => {
    expect(viewerAddress('current', WALLET)).toBe(WALLET);
  });

  it('is null when neither is an address', () => {
    expect(viewerAddress('current', undefined)).toBeNull();
    expect(viewerAddress('', null)).toBeNull();
  });

  it('ignores a malformed identity rather than comparing against it', () => {
    expect(viewerAddress('0x1234', WALLET)).toBe(WALLET);
  });
});

describe('shortAddress', () => {
  it('keeps the start and end of a wallet so two of them can be told apart', () => {
    expect(shortAddress('0x9e743e5C7Ad9943b108D28Ee000216ad3F8844FE')).toBe('0x9e74…44FE');
  });
});
