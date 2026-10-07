import { describe, expect, it } from 'vitest';
import { chainProof, explorerAddressUrl, explorerTxUrl } from '@/utils/chainProof';

describe('chainProof', () => {
  it('is on-chain for a post read back from the chain, even without our own tx hash', () => {
    expect(chainProof({ activityId: '12' })).toEqual({ state: 'onchain', txHash: undefined });
  });

  it('is on-chain for a local record whose recording was confirmed', () => {
    expect(chainProof({ onchainActivityId: '7', txHash: '0xabc' })).toEqual({
      state: 'onchain',
      txHash: '0xabc',
    });
  });

  it('is local when nothing proves the chain has it', () => {
    expect(chainProof({})).toEqual({ state: 'local' });
    expect(chainProof({ txHash: '0xabc' })).toEqual({ state: 'local' });
  });
});

describe('explorerTxUrl', () => {
  it('joins the explorer base and the hash, ignoring a trailing slash', () => {
    expect(explorerTxUrl('https://sepolia.etherscan.io/', '0xabc')).toBe(
      'https://sepolia.etherscan.io/tx/0xabc'
    );
  });

  it('is null without a hash or an explorer (a local chain has none)', () => {
    expect(explorerTxUrl(undefined, '0xabc')).toBeNull();
    expect(explorerTxUrl('https://x.test', undefined)).toBeNull();
  });
});

describe('explorerAddressUrl', () => {
  it('joins the explorer and the address', () => {
    expect(explorerAddressUrl('https://sepolia.etherscan.io/', '0xabc')).toBe(
      'https://sepolia.etherscan.io/address/0xabc'
    );
  });

  it('is null without an explorer or an address', () => {
    expect(explorerAddressUrl(undefined, '0xabc')).toBeNull();
    expect(explorerAddressUrl('https://x.test', null)).toBeNull();
  });
});
