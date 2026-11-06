/** Wallet ids arrive checksummed from the wallet and lowercased from the chain index. */
export function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** `0x1234…abcd`: enough to tell two addresses apart at a glance. */
export function shortAddress(wallet: string): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

const WALLET_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/**
 * Who the viewer is, for deciding what to show (do I own this club?). The signed-in identity is known
 * from login; the wallet address only exists once the gas-free wallet has started, and a failed start
 * made the owner of a club look like a stranger. Writes still need the wallet itself.
 */
export function viewerAddress(
  currentUserId: string,
  walletAddress: string | null | undefined
): string | null {
  if (WALLET_PATTERN.test(currentUserId)) return currentUserId;
  return walletAddress && WALLET_PATTERN.test(walletAddress) ? walletAddress : null;
}
