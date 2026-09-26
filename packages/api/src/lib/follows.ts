import type { Address } from './address.js';
import { IntentError } from './intentError.js';
import { logError } from './logError.js';
import { createSerialQueue } from './serialQueue.js';
import { createIntentGuards, unixNow } from './signedIntent.js';

export type FollowErrorCode = 'invalid' | 'expired' | 'bad_signature' | 'self_follow';

export class FollowError extends IntentError<FollowErrorCode> {
  constructor(code: FollowErrorCode, message: string) {
    super(code, message);
    this.name = 'FollowError';
  }
}

const guard = createIntentGuards((code, message) => new FollowError(code, message));

export interface FollowIntent {
  follower: Address;
  followee: Address;
  action: 'follow' | 'unfollow';
  deadline: number;
}

export interface FollowRecord {
  entityKey: string;
  follower: Address;
  followee: Address;
  /** Unix seconds; 0 for follows written before the timestamp existed. */
  followedAt: number;
}

export interface FollowPage {
  entries: FollowRecord[];
  truncated: boolean;
}

export interface FollowStore {
  find(follower: Address, followee: Address): Promise<FollowRecord | null>;
  create(input: {
    follower: Address;
    followee: Address;
    signature: string;
    deadline: number;
    followedAt: number;
  }): Promise<FollowRecord>;
  remove(entityKey: string): Promise<void>;
  following(follower: Address): Promise<FollowPage>;
  followers(followee: Address): Promise<FollowPage>;
}

export interface FollowServiceDeps {
  store: FollowStore;
  verify(intent: FollowIntent, signature: string): Promise<boolean>;
  now?: () => number;
  /** Told once about each new follow, after it is stored. It must not throw; a failure here never fails the follow. */
  onFollowed?(follower: Address, followee: Address): Promise<void> | void;
}

function parseIntent(raw: unknown): FollowIntent {
  const input = guard.record(raw);
  if (input.action !== 'follow' && input.action !== 'unfollow') {
    throw new FollowError('invalid', 'action must be follow or unfollow');
  }
  const deadline = guard.deadline(input.deadline);
  return {
    follower: guard.address(input.follower, 'follower'),
    followee: guard.address(input.followee, 'followee'),
    action: input.action,
    deadline,
  };
}

export function createFollowService({
  store,
  verify,
  now = unixNow,
  onFollowed,
}: FollowServiceDeps) {
  const serialize = createSerialQueue();

  return {
    async apply(request: { intent: unknown; signature: string }) {
      const intent = parseIntent(request.intent);
      guard.requireSignature(request.signature);
      if (intent.follower === intent.followee) {
        throw new FollowError('self_follow', 'You cannot follow yourself');
      }
      const current = now();
      guard.requireLiveDeadline(intent.deadline, current);
      await guard.requireValidSignature(verify, intent, request.signature, 'follower');

      return serialize(async () => {
        const existing = await store.find(intent.follower, intent.followee);
        if (intent.action === 'unfollow') {
          if (existing) await store.remove(existing.entityKey);
          return { following: false, created: false };
        }
        if (existing) return { following: true, created: false };
        await store.create({
          follower: intent.follower,
          followee: intent.followee,
          signature: request.signature,
          deadline: intent.deadline,
          followedAt: current,
        });
        return { following: true, created: true };
      }).then(async (result) => {
        if (result.created) {
          try {
            await onFollowed?.(intent.follower, intent.followee);
          } catch (error) {
            logError('[follows] Telling the followee failed', error);
          }
        }
        return result;
      });
    },

    async following(address: unknown) {
      const page = await store.following(guard.address(address, 'address'));
      return { addresses: page.entries.map((r) => r.followee), truncated: page.truncated };
    },

    async followers(address: unknown) {
      const page = await store.followers(guard.address(address, 'address'));
      return {
        addresses: page.entries.map((r) => r.follower),
        entries: page.entries.map((r) => ({ address: r.follower, followedAt: r.followedAt })),
        truncated: page.truncated,
      };
    },
  };
}
