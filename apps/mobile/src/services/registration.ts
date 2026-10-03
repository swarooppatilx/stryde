import { services } from '@repo/shared';

/**
 * Whether this address already has a profile. A profile with no chain (Sandbox) has nothing
 * registered to find, so it answers no instead of failing on a read that can never succeed.
 */
export async function isRegisteredOnChain(address: `0x${string}`): Promise<boolean> {
  if (services.client.isChainOffline()) return false;
  return services.profile.isRegistered(address);
}
