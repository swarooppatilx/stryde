import type { Address } from './address.js';
import { IntentError } from './intentError.js';
import { createSerialQueue } from './serialQueue.js';
import { createIntentGuards, unixNow } from './signedIntent.js';

export type AccountDeleteErrorCode = 'invalid' | 'expired' | 'bad_signature';

export class AccountDeleteError extends IntentError<AccountDeleteErrorCode> {
  constructor(code: AccountDeleteErrorCode, message: string) {
    super(code, message);
    this.name = 'AccountDeleteError';
  }
}

const guard = createIntentGuards((code, message) => new AccountDeleteError(code, message));

export interface AccountDeleteIntent {
  owner: Address;
  deadline: number;
}

/** Removes every record of one kind that belongs to the wallet and says how many went. */
export type Eraser = (owner: Address) => Promise<number>;

/** One per kind of record the server writes for an account. */
export interface AccountErasers {
  follows: Eraser;
  posts: Eraser;
  about: Eraser;
  commentLikes: Eraser;
  reports: Eraser;
  pushTokens: Eraser;
  beacons: Eraser;
}

export interface AccountDeleteServiceDeps {
  erasers: AccountErasers;
  verify(intent: AccountDeleteIntent, signature: string): Promise<boolean>;
  now?: () => number;
}

function parseIntent(raw: unknown): AccountDeleteIntent {
  const input = guard.record(raw);
  return {
    owner: guard.address(input.owner, 'owner'),
    deadline: guard.deadline(input.deadline),
  };
}

const KINDS = [
  'follows',
  'posts',
  'about',
  'commentLikes',
  'reports',
  'pushTokens',
  'beacons',
] as const;

export function createAccountDeleteService({
  erasers,
  verify,
  now = unixNow,
}: AccountDeleteServiceDeps) {
  const serialize = createSerialQueue();

  return {
    async apply(request: { intent: unknown; signature: string }) {
      const intent = parseIntent(request.intent);
      guard.requireSignature(request.signature);
      guard.requireLiveDeadline(intent.deadline, now());
      await guard.requireValidSignature(verify, intent, request.signature, 'owner');

      // One kind at a time: the server signs every removal with one wallet, which must keep its order.
      return serialize(async () => {
        const counts = {} as Record<(typeof KINDS)[number], number>;
        for (const kind of KINDS) counts[kind] = await erasers[kind](intent.owner);
        return { deleted: true as const, counts };
      });
    },
  };
}
