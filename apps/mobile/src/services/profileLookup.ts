import { services } from '@repo/shared';
import { sameAddress } from '@/utils/address';
import { logger } from '@/utils/logger';

/** The username `address` registered onchain, or null when unknown or the lookup fails. */
export async function lookupUsername(address: `0x${string}`): Promise<string | null> {
  try {
    const users = await services.profile.getRegisteredUsers();
    return users.find((u) => sameAddress(u.wallet, address))?.username || null;
  } catch (error) {
    logger.warn('[profile] Username lookup failed', error);
    return null;
  }
}
