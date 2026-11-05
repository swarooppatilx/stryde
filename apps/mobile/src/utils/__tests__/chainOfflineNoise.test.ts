import { services } from '@repo/shared';
import { describe, expect, it } from 'vitest';
import { CHAIN_OFFLINE_MESSAGE, isChainOfflineNoise } from '@/utils/chainOfflineNoise';

describe('CHAIN_OFFLINE_MESSAGE', () => {
  it('is the text of the shared error the offline chain throws, so the two cannot drift apart', () => {
    expect(new services.client.ChainOfflineError().message).toContain(CHAIN_OFFLINE_MESSAGE);
  });
});

describe('isChainOfflineNoise', () => {
  it('recognises the error itself and the way viem wraps it (message or details)', () => {
    expect(isChainOfflineNoise(['x', new services.client.ChainOfflineError()])).toBe(true);
    expect(
      isChainOfflineNoise([
        '[Social] Failed to fetch users:',
        Object.assign(new Error('An unknown RPC error occurred.'), {
          details: `The ${CHAIN_OFFLINE_MESSAGE} for this session`,
        }),
      ])
    ).toBe(true);
    expect(
      isChainOfflineNoise([
        new Error(`An unknown RPC error occurred.\n\nDetails: ${CHAIN_OFFLINE_MESSAGE}`),
      ])
    ).toBe(true);
  });

  it('is false for any other failure, so a real outage is never hidden', () => {
    expect(isChainOfflineNoise(['x', new Error('fetch failed: connection refused')])).toBe(false);
    expect(isChainOfflineNoise(['just text', 42, null, undefined])).toBe(false);
    expect(isChainOfflineNoise([])).toBe(false);
  });

  it('is false for plain text that merely mentions it, only errors count', () => {
    expect(isChainOfflineNoise([`note: ${CHAIN_OFFLINE_MESSAGE}`])).toBe(false);
  });
});
