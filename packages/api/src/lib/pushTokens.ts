import type { Address } from './address.js';
import { IntentError } from './intentError.js';
import type { PushTokenDirectory } from './pushSender.js';
import { createSerialQueue } from './serialQueue.js';
import { createIntentGuards, unixNow } from './signedIntent.js';

export type PushTokenErrorCode = 'invalid' | 'expired' | 'bad_signature';

export class PushTokenError extends IntentError<PushTokenErrorCode> {
  constructor(code: PushTokenErrorCode, message: string) {
    super(code, message);
    this.name = 'PushTokenError';
  }
}

const guard = createIntentGuards((code, message) => new PushTokenError(code, message));

export const PUSH_PLATFORMS = ['android', 'ios'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

/** A person's phones are few; the oldest are dropped past this. */
export const MAX_TOKENS_PER_OWNER = 5;
const TOKEN_PATTERN = /^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]{1,100}\]$/;

export interface PushIntent {
  owner: Address;
  token: string;
  platform: PushPlatform;
  action: 'register' | 'unregister';
  deadline: number;
}

export interface PushTokenRecord {
  entityKey: string;
  owner: Address;
  token: string;
  platform: PushPlatform;
  /** Unix seconds. */
  registeredAt: number;
}

export interface PushTokenStore {
  forOwner(owner: Address): Promise<PushTokenRecord[]>;
  /** Every record holding this token, whoever registered it. */
  withToken(token: string): Promise<PushTokenRecord[]>;
  create(input: {
    owner: Address;
    token: string;
    platform: PushPlatform;
    signature: string;
    deadline: number;
    registeredAt: number;
  }): Promise<PushTokenRecord>;
  remove(entityKey: string): Promise<void>;
  /** Deletes every record this wallet registered, and says how many went (account deletion). */
  removeAllFor(owner: Address): Promise<number>;
}

export interface PushTokenServiceDeps {
  store: PushTokenStore;
  verify(intent: PushIntent, signature: string): Promise<boolean>;
  now?: () => number;
}

function parseIntent(raw: unknown): PushIntent {
  const input = guard.record(raw);
  if (input.action !== 'register' && input.action !== 'unregister') {
    throw new PushTokenError('invalid', 'action must be register or unregister');
  }
  const platform = PUSH_PLATFORMS.find((p) => p === input.platform);
  if (!platform) throw new PushTokenError('invalid', 'platform must be android or ios');
  const token = guard.string(input.token, 'token');
  if (!TOKEN_PATTERN.test(token)) throw new PushTokenError('invalid', 'token is not a push token');
  return {
    owner: guard.address(input.owner, 'owner'),
    token,
    platform,
    action: input.action,
    deadline: guard.deadline(input.deadline),
  };
}

export function createPushTokenService({ store, verify, now = unixNow }: PushTokenServiceDeps) {
  const serialize = createSerialQueue();

  const directory: PushTokenDirectory = {
    async tokensFor(owner) {
      return (await store.forOwner(owner)).map((record) => record.token);
    },
    async forget(token) {
      await serialize(async () => {
        for (const record of await store.withToken(token)) await store.remove(record.entityKey);
      });
    },
  };

  return {
    directory,

    async apply(request: { intent: unknown; signature: string }) {
      const intent = parseIntent(request.intent);
      guard.requireSignature(request.signature);
      const current = now();
      guard.requireLiveDeadline(intent.deadline, current);
      await guard.requireValidSignature(verify, intent, request.signature, 'owner');

      return serialize(async () => {
        const holders = await store.withToken(intent.token);
        if (intent.action === 'unregister') {
          for (const record of holders.filter((r) => r.owner === intent.owner)) {
            await store.remove(record.entityKey);
          }
          return { registered: false };
        }
        // A phone signed in as someone else now belongs to them: the old owner stops receiving its pushes.
        for (const record of holders.filter((r) => r.owner !== intent.owner)) {
          await store.remove(record.entityKey);
        }
        if (holders.some((r) => r.owner === intent.owner))
          return { registered: true, created: false };

        const mine = (await store.forOwner(intent.owner)).sort(
          (a, b) => a.registeredAt - b.registeredAt
        );
        for (const record of mine.slice(0, Math.max(0, mine.length - MAX_TOKENS_PER_OWNER + 1))) {
          await store.remove(record.entityKey);
        }
        await store.create({
          owner: intent.owner,
          token: intent.token,
          platform: intent.platform,
          signature: request.signature,
          deadline: intent.deadline,
          registeredAt: current,
        });
        return { registered: true, created: true };
      });
    },
  };
}
