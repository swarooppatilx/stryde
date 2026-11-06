import { shortAddress } from '@/utils/address';

/** What to call an account on a pill: its ENS name if it has one, else the short address; null with neither. */
export function walletLabel({
  ensName,
  address,
}: {
  ensName: string | null | undefined;
  address: string | null | undefined;
}): string | null {
  const name = ensName?.trim();
  if (name) return name;
  return address ? shortAddress(address) : null;
}
