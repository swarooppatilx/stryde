import { isAddress } from 'viem';
import { sameAddress, shortAddress } from '@/utils/address';

interface Opponent {
  wallet: string;
  username: string;
}

/**
 * A typed wallet address as someone to challenge, when no one on the list has it (a friend who has
 * not signed up here yet, or the list could not load). Null for anything else.
 */
export function opponentFromQuery(
  query: string,
  known: readonly Opponent[],
  me: string
): Opponent | null {
  const wallet = query.trim();
  if (!isAddress(wallet, { strict: false })) return null;
  if (sameAddress(wallet, me)) return null;
  if (known.some((o) => sameAddress(o.wallet, wallet))) return null;
  return { wallet, username: shortAddress(wallet) };
}
