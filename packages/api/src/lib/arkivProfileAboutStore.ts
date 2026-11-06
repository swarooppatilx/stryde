import { eq, or } from '@arkiv-network/sdk/query';
import { addr, bytes, defineSchema, u64 } from '@arkiv-network/sdk/schema';
import type { Address } from './address.js';
import {
  type ArkivPublicClient,
  type ArkivWalletClient,
  createEntityStore,
  type JsonEntityLike,
  readJson,
  secondsAttribute,
  walletAttribute,
} from './arkivEntityStore.js';
import type { AboutRecord, AboutStore } from './profileAbout.js';

export const AboutSchema = defineSchema('profile_about', {
  author: addr().indexed(),
  updated_at: u64().indexed(),
  data: bytes(),
});

export function aboutAttributes(author: Address, updatedAt: number) {
  return {
    author: addr(author),
    updated_at: u64(updatedAt),
  };
}

export function aboutFromEntity(entity: JsonEntityLike): AboutRecord | null {
  const author = walletAttribute(entity, 'author');
  if (!author) return null;

  const fields = readJson(entity) as { bio?: unknown; location?: unknown } | null;
  if (!fields || typeof fields.bio !== 'string' || typeof fields.location !== 'string') return null;

  return {
    entityKey: entity.key,
    author,
    bio: fields.bio,
    location: fields.location,
    updatedAt: secondsAttribute(entity, 'updated_at'),
  };
}

/** Bio and location as Arkiv entities written by this server's signer; only that signer's entities count. */
export function createArkivAboutStore(
  publicClient: ArkivPublicClient,
  walletClient: ArkivWalletClient
): AboutStore {
  const entities = createEntityStore(publicClient, walletClient, AboutSchema);

  const fetchFor = async (authors: Address[]): Promise<AboutRecord[]> => {
    const authorFilter =
      authors.length === 1
        ? eq('author', addr(authors[0] as Address))
        : or(...authors.map((a) => eq('author', addr(a))));
    const result = await entities.queryWithPayload([authorFilter]);
    return result.entities
      .map((entity) => aboutFromEntity(entity))
      .filter((record): record is AboutRecord => record !== null);
  };

  return {
    async find(author) {
      const records = await fetchFor([author]);
      // Newest first, in case a failed cleanup left an older version behind.
      return records.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
    },

    async create({ author, bio, location, signature, deadline, updatedAt }) {
      const entityKey = await entities.create(
        { bio, location, signature, deadline },
        aboutAttributes(author, updatedAt)
      );
      return { entityKey, author, bio, location, updatedAt };
    },

    remove: (entityKey) => entities.remove(entityKey),
    removeAllFor: (author) => entities.removeAll([eq('author', addr(author))]),
    many: (authors) => (authors.length === 0 ? Promise.resolve([]) : fetchFor(authors)),
  };
}
