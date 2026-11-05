import { ExpirationTime } from '@arkiv-network/sdk';
import { asc, type Expression, gt, lte } from '@arkiv-network/sdk/query';
import { key, u64 } from '@arkiv-network/sdk/schema';
import type { createArkivPublicClient, createArkivWalletClient } from './arkiv.js';
import { logError } from './logError.js';

/**
 * The longest an entity may live past the block it is extended in (the SDK's MAX_LIFETIME, about
 * 182.5 days). Not exported by the SDK, so it is repeated here; renewals ask for less than this.
 */
const MAX_LIFETIME_BLOCKS = 7_884_000n;
const SECONDS_PER_BLOCK = 2n;
const DAY_SECONDS = 86_400n;
const PAGE_LIMIT = 100;

const blocksForDays = (days: number): bigint => (BigInt(days) * DAY_SECONDS) / SECONDS_PER_BLOCK;

export interface RenewalOptions {
  /** Renew entities that expire within this many days. */
  windowDays: number;
  /** Each renewed entity gets at least this many days from now. */
  extendDays: number;
  /** Cap per run so one run stays inside the function time limit. */
  maxRenewals: number;
  /** Cap on query pages, so a huge backlog cannot run unbounded. */
  maxPages: number;
}

export const DEFAULT_RENEWAL: RenewalOptions = {
  windowDays: 60,
  extendDays: 180,
  maxRenewals: 25,
  maxPages: 20,
};

export interface ExpiringEntity {
  key: `0x${string}`;
  expiresAt: bigint;
}

export interface RenewalClient {
  head(): Promise<bigint>;
  expiring(
    cutoff: bigint,
    maxPages: number
  ): Promise<{ entities: ExpiringEntity[]; complete: boolean }>;
  extend(key: `0x${string}`, target: bigint): Promise<void>;
}

export interface RenewalReport {
  head: string;
  found: number;
  renewed: number;
  failed: number;
  /** True when more entities are waiting than this run could scan or renew. */
  more: boolean;
}

/** The block a renewed entity should reach: never earlier than its current deadline. */
export function renewalTarget(head: bigint, expiresAt: bigint, extendDays: number): bigint | null {
  const lifetime = blocksForDays(extendDays);
  if (lifetime > MAX_LIFETIME_BLOCKS) return null;
  const wanted = head + lifetime;
  return wanted > expiresAt ? wanted : null;
}

/** Soonest-expiring first, so the entities closest to vanishing are saved when the cap bites. */
function compareBigint(a: bigint, b: bigint): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

export function planRenewals(
  head: bigint,
  entities: ExpiringEntity[],
  options: RenewalOptions
): { key: `0x${string}`; target: bigint }[] {
  const plan: { key: `0x${string}`; target: bigint }[] = [];
  const live = entities
    .filter((entity) => entity.expiresAt > head)
    .sort((a, b) => compareBigint(a.expiresAt, b.expiresAt));
  for (const entity of live) {
    const target = renewalTarget(head, entity.expiresAt, options.extendDays);
    if (target !== null) plan.push({ key: entity.key, target });
  }
  return plan;
}

/** Sequential on purpose: one signer, so writes share one nonce. A failure never stops the rest. */
export async function renewExpiring(
  client: RenewalClient,
  options: RenewalOptions = DEFAULT_RENEWAL
): Promise<RenewalReport> {
  const head = await client.head();
  const cutoff = head + blocksForDays(options.windowDays);
  const { entities, complete } = await client.expiring(cutoff, options.maxPages);
  const plan = planRenewals(head, entities, options);
  const batch = plan.slice(0, options.maxRenewals);
  let renewed = 0;
  let failed = 0;
  for (const item of batch) {
    try {
      await client.extend(item.key, item.target);
      renewed += 1;
    } catch (error) {
      logError(`[arkiv] Could not renew ${item.key}:`, error);
      failed += 1;
    }
  }
  return {
    head: head.toString(),
    found: plan.length,
    renewed,
    failed,
    more: !complete || plan.length > batch.length,
  };
}

type PublicClient = ReturnType<typeof createArkivPublicClient>;
type WalletClient = ReturnType<typeof createArkivWalletClient>;

/** Reads this server signer's Stryde entities and extends them; only the creator may extend. */
export function createArkivRenewalClient(
  publicClient: PublicClient,
  walletClient: WalletClient
): RenewalClient {
  const creator = walletClient.account.address;
  return {
    head: () => publicClient.getBlockNumber({ cacheTime: 0 }),

    async expiring(cutoff, maxPages) {
      // Walks by key, not by offset: the node cannot pin a block, so an entity created or removed
      // between two pages would shift every offset after it.
      const entities: ExpiringEntity[] = [];
      let after: `0x${string}` | null = null;
      for (let pages = 1; ; pages += 1) {
        const filters: Expression[] = [lte('$expiresAt', u64(cutoff))];
        if (after) filters.push(gt('$key', key(after)));
        const page = await publicClient
          .select({ $key: true, $expiresAt: true })
          .where(...filters)
          .createdBy(creator)
          .orderBy(asc('$key'))
          .limit(PAGE_LIMIT)
          .fetch();
        for (const entity of page.entities) {
          entities.push({ key: entity.$key, expiresAt: entity.$expiresAt });
        }
        const last = page.entities.at(-1);
        if (page.entities.length + page.skipped < PAGE_LIMIT || !last) {
          return { entities, complete: true };
        }
        if (pages >= maxPages) return { entities, complete: false };
        after = last.$key;
      }
    },

    async extend(entityKey, target) {
      await walletClient.extendEntity({
        entityKey,
        expiration: ExpirationTime.atBlock(target, { atLeast: ExpirationTime.fromHours(1) }),
      });
    },
  };
}
