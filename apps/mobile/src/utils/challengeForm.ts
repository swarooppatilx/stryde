import { formatEther } from 'viem';
import { shortAddress } from '@/utils/address';
import { parseEthAmount } from './eth';

const MAX_TARGET_METERS = 1_000_000;

/** A positive decimal from a text field. Accepts "5,5" as well as "5.5" (many keyboards only offer a comma). */
export function parseDecimal(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(text)) return null;
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : null;
}

export interface ChallengeFormInput {
  opponent: string | null;
  distanceInput: string;
  /** 1000 for km, 1609.344 for miles. */
  metersPerUnit: number;
  stakeInput: string;
  /** Null while the balance hasn't loaded: don't block on it. */
  balanceWei: bigint | null;
}

/** Which part of the form a refusal is about, so the screen can point at it. */
export type ChallengeField = 'opponent' | 'distance' | 'stake';

export type ChallengeFormResult =
  | { ok: true; targetMeters: number; stakeWei: bigint }
  | { ok: false; reason: string; field: ChallengeField };

/** Checks the form in the order the user fills it and says what is wrong in plain words. */
export function validateChallenge(input: ChallengeFormInput): ChallengeFormResult {
  if (!input.opponent) return { ok: false, reason: 'Pick who to challenge', field: 'opponent' };

  const distance = parseDecimal(input.distanceInput);
  if (distance === null || distance <= 0) {
    return { ok: false, reason: 'Enter a target distance above 0', field: 'distance' };
  }
  const targetMeters = Math.round(distance * input.metersPerUnit);
  if (targetMeters > MAX_TARGET_METERS) {
    return { ok: false, reason: 'Target distance is too large (max 1,000 km)', field: 'distance' };
  }

  // Parsed from the text itself: through a number, 0.0000001 becomes "1e-7", which isn't an amount.
  const stakeWei = parseEthAmount(input.stakeInput) ?? 0n;
  if (stakeWei <= 0n) return { ok: false, reason: 'Enter a stake above 0 ETH', field: 'stake' };

  if (input.balanceWei !== null && stakeWei > input.balanceWei) {
    return {
      ok: false,
      reason: `Not enough ETH: your account has ${formatEther(input.balanceWei)} ETH`,
      field: 'stake',
    };
  }
  return { ok: true, targetMeters, stakeWei };
}

/**
 * Why a wallet cannot match a challenge stake, or null when it can (or when the balance has not
 * loaded yet, which must not block the action). Without this, accepting from an unfunded wallet went
 * to the chain and came back as "UserOperation reverted during simulation with reason 0x".
 */
export function stakeShortfall(balanceWei: bigint | null, stakeWei: bigint): string | null {
  if (balanceWei === null || balanceWei >= stakeWei) return null;
  return `Matching this stake takes ${formatEther(stakeWei)} ETH and your wallet has ${formatEther(balanceWei)} ETH.`;
}

/** Who a challenge goes to. A name always comes with the short address, and an address is never printed twice. */
export function opponentLabel(name: string, wallet: string): string {
  const short = shortAddress(wallet);
  return name && name !== short ? `${name} (${short})` : short;
}
