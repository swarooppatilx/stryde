import { ExpirationTime } from '@arkiv-network/sdk';
import { eq } from '@arkiv-network/sdk/query';
import { bytes, defineSchema, str } from '@arkiv-network/sdk/schema';
import { stringToBytes } from 'viem';
import type { createArkivPublicClient, createArkivWalletClient } from './arkiv.js';
import { logError } from './logError.js';

type Hex = `0x${string}`;

/**
 * Which activities already counted toward a season. SeasonManager adds whatever it is sent,
 * so without this a replayed request would count one run twice.
 *
 * This is a best-effort guard, not an atomic one: two server instances can both pass `has`
 * before either reserves. Only an onchain check in the contract could close that gap.
 */
export interface ContributionLedger {
  /** True once the activity counted, or while a send for it is in flight or unconfirmed. */
  has(activityHash: Hex): Promise<boolean>;
  /**
   * Claims the activity before its transaction is sent and returns the claim's key. A send
   * whose outcome is unknown (timed out, may still mine) keeps the claim, so a replay cannot
   * credit the run twice.
   */
  reserve(activityHash: Hex, participant: Hex): Promise<string>;
  /** Drops exactly this claim after a definite failure (revert, refusal) so the app may retry. */
  release(claim: string): Promise<void>;
  /** Records that the activity counted, then clears the claim; a failure to clear it is only logged. */
  mark(activityHash: Hex, participant: Hex, claim: string): Promise<void>;
}

/** A counted activity or an in-flight claim for one; `state` tells them apart. */
export const ContributionSchema = defineSchema('season_contribution', {
  activity_hash: str().indexed(),
  state: str().indexed(),
  data: bytes(),
});
/**
 * As long as Rabdi lets an entity live (about 182.5 days). A season longer than this could in theory
 * let an activity count twice after its record expires; the contract's own check is the real guard.
 */
const LIFETIME_DAYS = 180;
/** A claim only needs to outlive a transaction stuck in the pool; after this it is assumed dropped. */
const PENDING_LIFETIME_DAYS = 2;

export function contributionAttributes(activityHash: Hex) {
  return { activity_hash: str(activityHash.toLowerCase()), state: str('counted') };
}

export function pendingAttributes(activityHash: Hex) {
  return { ...contributionAttributes(activityHash), state: str('pending') };
}

const body = (participant: Hex) =>
  stringToBytes(JSON.stringify({ v: 1, participant: participant.toLowerCase() }));

export function createMemoryLedger(): ContributionLedger {
  const counted = new Set<string>();
  const claims = new Map<string, string>();
  let nextClaim = 0;
  return {
    async has(activityHash) {
      const hash = activityHash.toLowerCase();
      return counted.has(hash) || [...claims.values()].includes(hash);
    },
    async reserve(activityHash) {
      const claim = `claim-${++nextClaim}`;
      claims.set(claim, activityHash.toLowerCase());
      return claim;
    },
    async release(claim) {
      claims.delete(claim);
    },
    async mark(activityHash, _participant, claim) {
      counted.add(activityHash.toLowerCase());
      claims.delete(claim);
    },
  };
}

type PublicClient = ReturnType<typeof createArkivPublicClient>;
type WalletClient = ReturnType<typeof createArkivWalletClient>;

/** Ledger entries are Arkiv entities written by this server's signer; only that signer's count. */
export function createArkivLedger(
  publicClient: PublicClient,
  walletClient: WalletClient
): ContributionLedger {
  const creator = walletClient.account.address;
  return {
    async has(activityHash) {
      const result = await publicClient
        .select({ $key: true })
        .from(ContributionSchema)
        .where(eq('activity_hash', str(activityHash.toLowerCase())))
        .createdBy(creator)
        .limit(1)
        .fetch();
      return result.entities.length > 0;
    },
    async reserve(activityHash, participant) {
      // Not readonly, so this one claim can be deleted again on a definite failure.
      const { entityKey } = await walletClient.createEntity(
        ContributionSchema,
        { ...pendingAttributes(activityHash), data: body(participant) },
        {
          expiration: ExpirationTime.fromDays(PENDING_LIFETIME_DAYS),
          flags: { readonly: false, permissionlessExtension: false },
        }
      );
      return entityKey;
    },
    async release(claim) {
      await walletClient.deleteEntity({ entityKey: claim as Hex });
    },
    async mark(activityHash, participant, claim) {
      await walletClient.createEntity(
        ContributionSchema,
        { ...contributionAttributes(activityHash), data: body(participant) },
        {
          expiration: ExpirationTime.fromDays(LIFETIME_DAYS),
          flags: { readonly: true, permissionlessExtension: false },
        }
      );
      // The activity counts now; a claim that lingers is harmless (it also blocks a replay).
      await walletClient.deleteEntity({ entityKey: claim as Hex }).catch((error) => {
        logError('[relay] Counted a contribution but could not clear its claim', error);
      });
    },
  };
}
