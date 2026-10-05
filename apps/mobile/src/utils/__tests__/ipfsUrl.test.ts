import { describe, expect, it } from 'vitest';
import { ipfsToHttpUrl } from '@/utils/ipfsUrl';

describe('ipfsToHttpUrl', () => {
  it('points a content id at the gateway', () => {
    expect(ipfsToHttpUrl('bafyabc')).toBe('https://gateway.pinata.cloud/ipfs/bafyabc');
  });
});
