/**
 * What the shared package's `ChainOfflineError` says (a test keeps the two equal). A profile with no
 * chain (Sandbox) switches the chain off on purpose, so every read fails with it, many times a minute.
 */
export const CHAIN_OFFLINE_MESSAGE = 'The chain is switched off for this session';

function mentionsOffline(value: unknown): boolean {
  if (!(value instanceof Error)) return false;
  const { details } = value as { details?: unknown };
  return (
    value.message.includes(CHAIN_OFFLINE_MESSAGE) ||
    (typeof details === 'string' && details.includes(CHAIN_OFFLINE_MESSAGE))
  );
}

/** True when a log call is reporting an expected failure of the switched-off chain, not a real outage. */
export function isChainOfflineNoise(args: readonly unknown[]): boolean {
  return args.some(mentionsOffline);
}
