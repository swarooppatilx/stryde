import type { StorageAdapter } from '@/platform';
import { ACCOUNT_OWNER_KEY, ownerAction } from '@/utils/accountOwner';

/**
 * Notes who is signed in. If it is a different person from last time (a session that ended and was
 * replaced without a log out), `wipe` runs first so they never inherit the old account's data or
 * unsent actions. Returns whether it wiped.
 */
export async function syncAccountOwner(
  storage: StorageAdapter,
  userId: string | null,
  wipe: () => Promise<void>
): Promise<boolean> {
  const action = ownerAction(await storage.getItem(ACCOUNT_OWNER_KEY), userId);
  if (action === 'none' || !userId) return false;
  if (action === 'reset') await wipe();
  await storage.setItem(ACCOUNT_OWNER_KEY, userId);
  return action === 'reset';
}
