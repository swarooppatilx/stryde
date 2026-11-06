import { describe, expect, it } from 'vitest';
import { createLocalDevWallet } from '@/services/localDevWallet';

const ANVIL_ACCOUNT_0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

describe('createLocalDevWallet', () => {
  it('signs on the local chain as Anvil account #1 for the first slot', () => {
    const { wallet, address } = createLocalDevWallet('http://127.0.0.1:8545');

    expect(address).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
    expect(wallet.account?.address).toBe(address);
    expect(wallet.chain?.id).toBe(31337);
    // Anvil signs for its own accounts: nothing is signed on the phone.
    expect(wallet.account?.type).toBe('json-rpc');
  });

  it('gives each slot its own athlete and never the relayer account #0', () => {
    const addresses = [0, 1, 2, 3, 4].map((slot) => createLocalDevWallet('http://x', slot).address);

    expect(new Set(addresses).size).toBe(5);
    expect(addresses).not.toContain(ANVIL_ACCOUNT_0);
  });
});
