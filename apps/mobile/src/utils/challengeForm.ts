import { formatEther } from 'viem';
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

/** `0x1234…abcd`: enough to tell two addresses apart at a glance. */
export function shortAddress(wallet: string): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

/** Who a challenge goes to. A name always comes with the short address, and an address is never printed twice. */
export function opponentLabel(name: string, wallet: string): string {
  const short = shortAddress(wallet);
  return name && name !== short ? `${name} (${short})` : short;
}
