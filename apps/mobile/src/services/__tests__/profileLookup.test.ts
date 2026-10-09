import { services } from '@repo/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupUsername } from '@/services/profileLookup';

const ME = '0x00000000000000000000000000000000000000AA' as const;

describe('lookupUsername', () => {
  afterEach(() => vi.restoreAllMocks());

  it('finds the athlete by wallet, ignoring address case', async () => {
    vi.spyOn(services.profile, 'getRegisteredUsers').mockResolvedValue([
      { wallet: '0x00000000000000000000000000000000000000bb', username: 'sam' },
      { wallet: ME.toLowerCase(), username: 'priya' },
    ] as never);

    expect(await lookupUsername(ME)).toBe('priya');
  });

  it('is null for a wallet nobody registered', async () => {
    vi.spyOn(services.profile, 'getRegisteredUsers').mockResolvedValue([] as never);

    expect(await lookupUsername(ME)).toBeNull();
  });

  it('is null, never a placeholder name, when the lookup fails', async () => {
    vi.spyOn(services.profile, 'getRegisteredUsers').mockRejectedValue(new Error('rpc down'));

    expect(await lookupUsername(ME)).toBeNull();
  });
});
