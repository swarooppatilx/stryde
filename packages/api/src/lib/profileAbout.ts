import type { Address } from './address.js';
import { IntentError } from './intentError.js';
import { createSerialQueue } from './serialQueue.js';
import { createIntentGuards, unixNow } from './signedIntent.js';
import { ONE_LINE_CONTROL_CHARACTERS } from './textRules.js';

export type AboutErrorCode = 'invalid' | 'expired' | 'bad_signature';

export class AboutError extends IntentError<AboutErrorCode> {
  constructor(code: AboutErrorCode, message: string) {
    super(code, message);
    this.name = 'AboutError';
  }
}

const guard = createIntentGuards((code, message) => new AboutError(code, message));

export const MAX_BIO_LENGTH = 160;
export const MAX_LOCATION_LENGTH = 60;

export interface AboutIntent {
  author: Address;
  bio: string;
  location: string;
  deadline: number;
}

export interface AboutRecord {
  entityKey: string;
  author: Address;
  bio: string;
  location: string;
  /** Unix seconds. */
  updatedAt: number;
}

export interface AboutStore {
  find(author: Address): Promise<AboutRecord | null>;
  create(input: {
    author: Address;
    bio: string;
    location: string;
    signature: string;
    deadline: number;
    updatedAt: number;
  }): Promise<AboutRecord>;
  remove(entityKey: string): Promise<void>;
  many(authors: Address[]): Promise<AboutRecord[]>;
  /** Deletes every record this wallet wrote, and says how many went (account deletion). */
  removeAllFor(author: Address): Promise<number>;
}

export interface AboutServiceDeps {
  store: AboutStore;
  verify(intent: AboutIntent, signature: string): Promise<boolean>;
  now?: () => number;
}

const MAX_AUTHORS_PER_READ = 100;

function parseIntent(raw: unknown): AboutIntent {
  const input = guard.record(raw);
  const deadline = guard.deadline(input.deadline);
  return {
    author: guard.address(input.author, 'author'),
    bio: guard.text(input.bio, 'bio', MAX_BIO_LENGTH, ONE_LINE_CONTROL_CHARACTERS),
    location: guard.text(
      input.location,
      'location',
      MAX_LOCATION_LENGTH,
      ONE_LINE_CONTROL_CHARACTERS
    ),
    deadline,
  };
}

export function createAboutService({ store, verify, now = unixNow }: AboutServiceDeps) {
  const serialize = createSerialQueue();

  return {
    /** Replaces the author's bio and location with what they signed; emptying both clears it. */
    async apply(request: { intent: unknown; signature: string }) {
      const intent = parseIntent(request.intent);
      guard.requireSignature(request.signature);
      const current = now();
      guard.requireLiveDeadline(intent.deadline, current);
      // The signature covers the exact (trimmed) text, so verify what we will store.
      await guard.requireValidSignature(verify, intent, request.signature, 'author');

      return serialize(async () => {
        const existing = await store.find(intent.author);
        if (!intent.bio && !intent.location) {
          if (existing) await store.remove(existing.entityKey);
          return { about: { bio: '', location: '' } };
        }
        // New version first: a failed write then leaves the old bio, never none.
        await store.create({
          author: intent.author,
          bio: intent.bio,
          location: intent.location,
          signature: request.signature,
          deadline: intent.deadline,
          updatedAt: current,
        });
        if (existing) await store.remove(existing.entityKey);
        return { about: { bio: intent.bio, location: intent.location } };
      });
    },

    /** Bio and location for each author that has set them; authors with none are left out. */
    async forAuthors(authors: unknown) {
      if (!Array.isArray(authors)) throw new AboutError('invalid', 'authors must be a list');
      if (authors.length > MAX_AUTHORS_PER_READ) {
        throw new AboutError(
          'invalid',
          `ask about at most ${MAX_AUTHORS_PER_READ} authors at once`
        );
      }
      const wanted = [...new Set(authors.map((a) => guard.address(a, 'author')))];
      const records = wanted.length > 0 ? await store.many(wanted) : [];
      const about: Record<string, { bio: string; location: string }> = {};
      // Oldest first, so the newest wins if a failed cleanup left two records for one author.
      for (const record of [...records].sort((a, b) => a.updatedAt - b.updatedAt)) {
        about[record.author] = { bio: record.bio, location: record.location };
      }
      return { about };
    },
  };
}
