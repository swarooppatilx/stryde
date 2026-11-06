import { type Expression, eq, or } from '@arkiv-network/sdk/query';
import { addr, bytes, defineSchema, u64 } from '@arkiv-network/sdk/schema';
import type { Address } from './address.js';
import {
  type ArkivPublicClient,
  type ArkivWalletClient,
  createEntityStore,
  type EntityLike,
  secondsAttribute,
  walletAttribute,
} from './arkivEntityStore.js';
import type { FollowPage, FollowRecord, FollowStore } from './follows.js';

/** One entity per follow. Only indexed columns can be filtered, so both wallets and the time are indexed. */
export const FollowSchema = defineSchema('follow', {
  follower: addr().indexed(),
  followee: addr().indexed(),
  followed_at: u64().indexed(),
  data: bytes(),
});

export function followAttributes(follower: Address, followee: Address, followedAt: number) {
  return {
    follower: addr(follower),
    followee: addr(followee),
    followed_at: u64(followedAt),
  };
}

export function followFromEntity(entity: EntityLike): FollowRecord | null {
  const follower = walletAttribute(entity, 'follower');
  const followee = walletAttribute(entity, 'followee');
  if (!follower || !followee) return null;
  return {
    entityKey: entity.key,
    follower,
    followee,
    followedAt: secondsAttribute(entity, 'followed_at'),
  };
}

/** Follows as Arkiv entities written by this server's signer; only that signer's entities count. */
export function createArkivFollowStore(
  publicClient: ArkivPublicClient,
  walletClient: ArkivWalletClient
): FollowStore {
  const entities = createEntityStore(publicClient, walletClient, FollowSchema);

  const page = async (...filters: Expression[]): Promise<FollowPage> => {
    const result = await entities.query(filters);
    return {
      entries: result.entities
        .map((entity) => followFromEntity(entity))
        .filter((record): record is FollowRecord => record !== null),
      truncated: result.truncated,
    };
  };

  return {
    async find(follower, followee) {
      const { entries } = await page(
        eq('follower', addr(follower)),
        eq('followee', addr(followee))
      );
      return entries[0] ?? null;
    },

    async create({ follower, followee, signature, deadline, followedAt }) {
      const entityKey = await entities.create(
        { signature, deadline },
        followAttributes(follower, followee, followedAt)
      );
      return { entityKey, follower, followee, followedAt };
    },

    remove: (entityKey) => entities.remove(entityKey),
    following: (follower) => page(eq('follower', addr(follower))),
    followers: (followee) => page(eq('followee', addr(followee))),
    removeAllFor: (address) =>
      entities.removeAll([or(eq('follower', addr(address)), eq('followee', addr(address)))]),
  };
}
