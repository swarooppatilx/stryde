import { services } from '@repo/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRegisteredOnChain } from '@/services/registration';

const address = '0x0000000000000000000000000000000000000001' as const;

afterEach(() => {
  services.client.setChainOffline(false);
  vi.restoreAllMocks();
});

describe('isRegisteredOnChain', () => {
  it('reads the chain when there is one', async () => {
    const read = vi.spyOn(services.profile, 'isRegistered').mockResolvedValue(true);

    await expect(isRegisteredOnChain(address)).resolves.toBe(true);
    expect(read).toHaveBeenCalledWith(address);
  });

  it('answers no without a chain call when the profile has no chain', async () => {
    services.client.setChainOffline(true);
    const read = vi.spyOn(services.profile, 'isRegistered');

    await expect(isRegisteredOnChain(address)).resolves.toBe(false);
    expect(read).not.toHaveBeenCalled();
  });
});
