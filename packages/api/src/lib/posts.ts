import type { Address } from './address.js';
import { IntentError } from './intentError.js';
import { createSerialQueue } from './serialQueue.js';
import { createIntentGuards, unixNow } from './signedIntent.js';
import { MULTI_LINE_CONTROL_CHARACTERS } from './textRules.js';

export type PostErrorCode = 'invalid' | 'expired' | 'bad_signature' | 'forbidden' | 'rate_limited';

export class PostError extends IntentError<PostErrorCode> {
  constructor(code: PostErrorCode, message: string) {
    super(code, message);
    this.name = 'PostError';
  }
}

const guard = createIntentGuards((code, message) => new PostError(code, message));

export const MAX_POST_LENGTH = 500;
export const MAX_PHOTOS = 4;
/** Each post is a write the server pays for, so one author cannot post without bound. */
export const MAX_POSTS_PER_DAY = 20;

export interface PostIntent {
  author: Address;
  action: 'create' | 'delete';
  /** Trimmed; empty for a delete. */
  text: string;
  /** IPFS content ids of the photos, in order; empty for a delete. */
  photos: string[];
  /** The post to delete; empty for a create. */
  postId: string;
  /**
   * Chosen by the app once per post and kept across retries, so sending the same post again returns
   * the one already stored instead of publishing it twice. Empty for a delete.
   */
  clientId: string;
  deadline: number;
}

export interface PostRecord {
  id: string;
  author: Address;
  text: string;
  photos: string[];
  /** Unix seconds. */
  createdAt: number;
  /** The id the author's app gave this post; see `PostIntent.clientId`. */
  clientId: string;
}

export interface PostStore {
  create(input: {
    author: Address;
    text: string;
    photos: string[];
    clientId: string;
    signature: string;
    deadline: number;
    createdAt: number;
  }): Promise<PostRecord>;
  /** The author's post that was stored for this client id, if any. */
  findByClientId(author: Address, clientId: string): Promise<PostRecord | null>;
  find(id: string): Promise<PostRecord | null>;
  remove(id: string): Promise<void>;
  /** The newest posts by any of these authors, newest first. */
  recent(authors: Address[], limit: number): Promise<PostRecord[]>;
  countSince(author: Address, since: number): Promise<number>;
  /** Deletes every record this wallet wrote, and says how many went (account deletion). */
  removeAllFor(author: Address): Promise<number>;
}

export interface PostServiceDeps {
  store: PostStore;
  verify(intent: PostIntent, signature: string): Promise<boolean>;
  now?: () => number;
}

const DAY_SECONDS = 24 * 60 * 60;
const MAX_AUTHORS_PER_READ = 100;
const MAX_POSTS_PER_READ = 50;
const CID_PATTERN = /^[A-Za-z0-9]{40,120}$/;
const POST_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function parseIntent(raw: unknown): PostIntent {
  const input = guard.record(raw);
  if (input.action !== 'create' && input.action !== 'delete') {
    throw new PostError('invalid', 'action must be create or delete');
  }
  const deadline = guard.deadline(input.deadline);
  const text = guard.text(input.text, 'text', MAX_POST_LENGTH, MULTI_LINE_CONTROL_CHARACTERS);
  if (!Array.isArray(input.photos) || input.photos.length > MAX_PHOTOS) {
    throw new PostError('invalid', `photos must be a list of at most ${MAX_PHOTOS}`);
  }
  const photos = input.photos.map((photo) => {
    if (typeof photo !== 'string' || !CID_PATTERN.test(photo)) {
      throw new PostError('invalid', 'each photo must be an IPFS content id');
    }
    return photo;
  });
  const postId = guard.string(input.postId, 'postId');
  const clientId = guard.string(input.clientId, 'clientId');

  if (input.action === 'create') {
    if (postId !== '') throw new PostError('invalid', 'a new post has no postId');
    if (!text && photos.length === 0)
      throw new PostError('invalid', 'a post needs text or a photo');
    if (!CLIENT_ID_PATTERN.test(clientId)) {
      throw new PostError('invalid', 'clientId must be 1 to 64 letters, digits, - or _');
    }
  } else {
    if (!POST_ID_PATTERN.test(postId)) throw new PostError('invalid', 'postId is required');
    if (clientId !== '') throw new PostError('invalid', 'deleting a post has no clientId');
    if (text || photos.length > 0) {
      throw new PostError('invalid', 'deleting a post carries no text or photos');
    }
  }
  return {
    author: guard.address(input.author, 'author'),
    action: input.action,
    text,
    photos,
    postId: postId,
    clientId: clientId,
    deadline,
  };
}

export function createPostService({ store, verify, now = unixNow }: PostServiceDeps) {
  const serialize = createSerialQueue();

  return {
    async apply(request: { intent: unknown; signature: string }) {
      const intent = parseIntent(request.intent);
      guard.requireSignature(request.signature);
      const current = now();
      guard.requireLiveDeadline(intent.deadline, current);
      await guard.requireValidSignature(verify, intent, request.signature, 'author');

      return serialize(async () => {
        if (intent.action === 'delete') {
          const existing = await store.find(intent.postId);
          if (!existing) return { deleted: true as const };
          if (existing.author !== intent.author) {
            throw new PostError('forbidden', 'You can only delete your own posts');
          }
          await store.remove(existing.id);
          return { deleted: true as const };
        }

        // A retry of a post that already went through: hand back the stored one, publish nothing new.
        const already = await store.findByClientId(intent.author, intent.clientId);
        if (already) return { post: already };

        if ((await store.countSince(intent.author, current - DAY_SECONDS)) >= MAX_POSTS_PER_DAY) {
          throw new PostError('rate_limited', 'You have posted a lot today; try again tomorrow');
        }
        const post = await store.create({
          author: intent.author,
          text: intent.text,
          photos: intent.photos,
          clientId: intent.clientId,
          signature: request.signature,
          deadline: intent.deadline,
          createdAt: current,
        });
        return { post };
      });
    },

    /** The newest posts by these authors, newest first. */
    async forAuthors(authors: unknown, limit: unknown) {
      if (!Array.isArray(authors)) throw new PostError('invalid', 'authors must be a list');
      if (authors.length > MAX_AUTHORS_PER_READ) {
        throw new PostError('invalid', `ask about at most ${MAX_AUTHORS_PER_READ} authors at once`);
      }
      if (
        typeof limit !== 'number' ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > MAX_POSTS_PER_READ
      ) {
        throw new PostError('invalid', `limit must be between 1 and ${MAX_POSTS_PER_READ}`);
      }
      const wanted = [...new Set(authors.map((a) => guard.address(a, 'author')))];
      const posts = wanted.length > 0 ? await store.recent(wanted, limit) : [];
      return { posts };
    },
  };
}
