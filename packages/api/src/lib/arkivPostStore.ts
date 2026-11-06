import { eq, gte, or } from '@arkiv-network/sdk/query';
import { addr, bytes, defineSchema, key, str, u64 } from '@arkiv-network/sdk/schema';
import type { Address } from './address.js';
import {
  type ArkivPublicClient,
  type ArkivWalletClient,
  createEntityStore,
  type JsonEntityLike,
  readJson,
  secondsAttribute,
  textAttribute,
  walletAttribute,
} from './arkivEntityStore.js';
import type { PostRecord, PostStore } from './posts.js';

export const PostSchema = defineSchema('post', {
  author: addr().indexed(),
  created_at: u64().indexed(),
  // Lets a retry of the same post find the one already stored.
  client_id: str().indexed(),
  data: bytes(),
});
const DAY_SECONDS = 24 * 60 * 60;
/** Reads look back this far: a feed shows recent posts, and the query stays small. */
const READ_WINDOW_DAYS = 30;

export function postAttributes(author: Address, createdAt: number, clientId = '') {
  return {
    author: addr(author),
    created_at: u64(createdAt),
    client_id: str(clientId),
  };
}

export function postFromEntity(entity: JsonEntityLike): PostRecord | null {
  const author = walletAttribute(entity, 'author');
  if (!author) return null;

  const fields = readJson(entity) as { text?: unknown; photos?: unknown } | null;
  if (!fields || typeof fields.text !== 'string' || !Array.isArray(fields.photos)) return null;
  if (!fields.photos.every((photo) => typeof photo === 'string')) return null;

  return {
    id: entity.key,
    author,
    text: fields.text,
    photos: fields.photos as string[],
    createdAt: secondsAttribute(entity, 'created_at'),
    clientId: textAttribute(entity, 'client_id') ?? '',
  };
}

/** Posts as Arkiv entities written by this server's signer; only that signer's entities count. */
export function createArkivPostStore(
  publicClient: ArkivPublicClient,
  walletClient: ArkivWalletClient,
  now: () => number = () => Math.floor(Date.now() / 1000)
): PostStore {
  const entities = createEntityStore(publicClient, walletClient, PostSchema);

  const authorFilter = (authors: Address[]) =>
    authors.length === 1
      ? eq('author', addr(authors[0] as Address))
      : or(...authors.map((a) => eq('author', addr(a))));

  return {
    async create({ author, text, photos, clientId, signature, deadline, createdAt }) {
      const entityKey = await entities.create(
        { text, photos, signature, deadline },
        postAttributes(author, createdAt, clientId)
      );
      return { id: entityKey, author, text, photos, createdAt, clientId };
    },

    async find(id) {
      // Scoped to this server's own posts by the store's creator filter: anything else with that key is not ours to read or remove.
      const { entities: found } = await entities.queryWithPayload(
        [eq('$key', key(id as `0x${string}`))],
        1
      );
      const entity = found[0];
      return entity ? postFromEntity(entity) : null;
    },

    remove: (id) => entities.remove(id),

    async recent(authors, limit) {
      if (authors.length === 0) return [];
      const since = now() - READ_WINDOW_DAYS * DAY_SECONDS;
      const result = await entities.queryWithPayload([
        authorFilter(authors),
        gte('created_at', u64(since)),
      ]);
      return result.entities
        .map((entity) => postFromEntity(entity))
        .filter((post): post is PostRecord => post !== null)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    },

    async findByClientId(author, clientId) {
      const result = await entities.queryWithPayload(
        [eq('author', addr(author)), eq('client_id', str(clientId))],
        1
      );
      const entity = result.entities[0];
      return entity ? postFromEntity(entity) : null;
    },

    removeAllFor: (author) => entities.removeAll([eq('author', addr(author))]),

    countSince: (author, since) =>
      entities.count([eq('author', addr(author)), gte('created_at', u64(since))]),
  };
}
