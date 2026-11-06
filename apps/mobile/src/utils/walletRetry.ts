const FIRST_MS = 15_000;
const MAX_MS = 120_000;

/**
 * How long to wait before quietly trying the gas-free wallet again after it failed to start.
 * Privy sometimes cannot create the smart wallet right after a cold start and succeeds a minute
 * later, so giving up until the next app launch left writes and lists stuck for no good reason.
 */
export function walletRetryDelayMs(failures: number): number {
  return Math.min(FIRST_MS * 2 ** Math.max(failures - 1, 0), MAX_MS);
}
