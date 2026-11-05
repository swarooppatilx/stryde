import type { SelfieCheckResult } from '@/services/worldIdService';

const SHOW_PROGRESS_MS = 600;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A stable 32-byte value for a wallet, so the same developer always gets the same "nullifier". */
function nullifierFor(signal: string): `0x${string}` {
  let hex = '';
  for (const char of signal.toLowerCase()) hex += char.charCodeAt(0).toString(16).padStart(2, '0');
  return `0x${hex.slice(0, 64).padEnd(64, '0')}`;
}

/** Stands in for the World ID selfie check on a profile with no World app: verifies at once. */
export async function devSelfieCheck(
  signal: string,
  wait: (ms: number) => Promise<void> = sleep
): Promise<SelfieCheckResult> {
  await wait(SHOW_PROGRESS_MS);
  return { nullifier: nullifierFor(signal), proof: { responses: [] } };
}
