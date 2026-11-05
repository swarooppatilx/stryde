import { describe, expect, it } from 'vitest';
import { walletLabel } from '@/utils/walletLabel';

const address = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

describe('walletLabel', () => {
  it('prefers the ENS name, since people recognise it', () => {
    expect(walletLabel({ ensName: 'asha.eth', address })).toBe('asha.eth');
  });

  it('falls back to the short address, so the full one never crowds a pill', () => {
    expect(walletLabel({ ensName: null, address })).toBe('0x5FbD…0aa3');
  });

  it('treats a blank name as no name', () => {
    expect(walletLabel({ ensName: '  ', address })).toBe('0x5FbD…0aa3');
  });

  it('has nothing to show without an address or a name', () => {
    expect(walletLabel({ ensName: null, address: null })).toBeNull();
  });
});
