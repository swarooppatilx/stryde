export const ACCOUNT_OWNER_KEY = '@stryde/account-owner';

export type OwnerAction = 'none' | 'remember' | 'reset';

/**
 * What to do when the signed-in account is seen: nothing while signed out or unchanged, remember it
 * the first time, and wipe the previous account's local data when it is someone else.
 */
export function ownerAction(stored: string | null, current: string | null): OwnerAction {
  if (!current) return 'none';
  if (!stored) return 'remember';
  return stored === current ? 'none' : 'reset';
}
