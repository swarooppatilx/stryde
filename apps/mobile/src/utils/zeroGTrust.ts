import type { ZeroGReceipt } from '@/services/coachService';

export type TrustTone = 'verified' | 'warning';

export interface TrustChip {
  label: string;
  tone: TrustTone;
}

/** A call held to TEE providers by the router's trust floor (`verified` or `private`). */
export const isTeeRouted = (receipt: ZeroGReceipt): boolean =>
  receipt.trustMode === 'verified' || receipt.trustMode === 'private';

/**
 * What a result's proof says about where it ran:
 * - "TEE verified": every call was held to TEE providers and the router checked one attestation,
 *   with none failing;
 * - "TEE only": every call was held to TEE providers, but no attestation result was reported (glm-5.3);
 * - "Standard provider, not TEE": a fallback model with no TEE provider ran at least one call.
 * Receipts saved before these fields existed say nothing, so show nothing.
 */
export function trustChip(receipts: readonly ZeroGReceipt[]): TrustChip | null {
  if (receipts.length === 0) return null;
  if (receipts.some((r) => r.trustMode === 'standard')) {
    return { label: 'Standard provider, not TEE', tone: 'warning' };
  }
  if (!receipts.every(isTeeRouted)) return null;
  const attested = receipts.some((r) => r.teeVerified === true);
  const failed = receipts.some((r) => r.teeVerified === false);
  return { label: attested && !failed ? 'TEE verified' : 'TEE only', tone: 'verified' };
}

/** "$0.0018" from micro-USD; "<$0.0001" for crumbs; null when 0G reported no USD cost. */
export function formatUsdMicro(micro: number | null | undefined): string | null {
  if (micro === null || micro === undefined || !Number.isFinite(micro) || micro < 0) return null;
  const usd = micro / 1_000_000;
  return usd < 0.0001 ? '<$0.0001' : `$${usd.toFixed(4)}`;
}

/** The whole result's cost: the sum of the calls that reported one, null when none did. */
export function totalCost(receipts: readonly ZeroGReceipt[]): string | null {
  const known = receipts.filter((r) => r.costUsdMicro !== null && r.costUsdMicro !== undefined);
  if (known.length === 0) return null;
  return formatUsdMicro(known.reduce((sum, r) => sum + (r.costUsdMicro as number), 0));
}
