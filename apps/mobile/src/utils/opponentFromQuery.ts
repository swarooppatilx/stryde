import { isAddress } from 'viem';

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
  const lower = wallet.toLowerCase();
  if (lower === me.toLowerCase()) return null;
  if (known.some((o) => o.wallet.toLowerCase() === lower)) return null;
  return { wallet, username: `${wallet.slice(0, 6)}…${wallet.slice(-4)}` };
}
