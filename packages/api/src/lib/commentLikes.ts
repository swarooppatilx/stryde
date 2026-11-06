import type { Address } from './address.js';
import { type Bytes32, isBytes32 } from './hex.js';
import { IntentError } from './intentError.js';
import { createSerialQueue } from './serialQueue.js';
import { createIntentGuards, unixNow } from './signedIntent.js';

export type CommentLikeErrorCode = 'invalid' | 'expired' | 'bad_signature';

export class CommentLikeError extends IntentError<CommentLikeErrorCode> {
  constructor(code: CommentLikeErrorCode, message: string) {
    super(code, message);
    this.name = 'CommentLikeError';
  }
}

const guard = createIntentGuards((code, message) => new CommentLikeError(code, message));

export interface CommentLikeIntent {
  liker: Address;
  /** The SocialRegistry comment id (bytes32) being liked. */
  commentId: Bytes32;
  action: 'like' | 'unlike';
  deadline: number;
}

export interface CommentLikeRecord {
  entityKey: string;
  liker: Address;
  commentId: Bytes32;
  /** Unix seconds. */
  likedAt: number;
}

export interface CommentLikePage {
  entries: CommentLikeRecord[];
  truncated: boolean;
}

export interface CommentLikeStore {
  find(liker: Address, commentId: Bytes32): Promise<CommentLikeRecord | null>;
  create(input: {
    liker: Address;
    commentId: Bytes32;
    signature: string;
    deadline: number;
    likedAt: number;
  }): Promise<CommentLikeRecord>;
  remove(entityKey: string): Promise<void>;
  likers(commentId: Bytes32): Promise<CommentLikePage>;
}

export interface CommentLikeServiceDeps {
  store: CommentLikeStore;
  verify(intent: CommentLikeIntent, signature: string): Promise<boolean>;
  now?: () => number;
}

/** One request may ask about this many comments. */
const MAX_COMMENTS_PER_READ = 100;
const READ_CONCURRENCY = 5;

function toCommentId(value: unknown): Bytes32 {
  if (!isBytes32(value)) {
    throw new CommentLikeError('invalid', 'commentId must be a 32-byte hex id');
  }
  return value.toLowerCase() as Bytes32;
}

function parseIntent(raw: unknown): CommentLikeIntent {
  const input = guard.record(raw);
  if (input.action !== 'like' && input.action !== 'unlike') {
    throw new CommentLikeError('invalid', 'action must be like or unlike');
  }
  const deadline = guard.deadline(input.deadline);
  return {
    liker: guard.address(input.liker, 'liker'),
    commentId: toCommentId(input.commentId),
    action: input.action,
    deadline,
  };
}

export function createCommentLikeService({ store, verify, now = unixNow }: CommentLikeServiceDeps) {
  const serialize = createSerialQueue();

  return {
    async apply(request: { intent: unknown; signature: string }) {
      const intent = parseIntent(request.intent);
      guard.requireSignature(request.signature);
      const current = now();
      guard.requireLiveDeadline(intent.deadline, current);
      await guard.requireValidSignature(verify, intent, request.signature, 'liker');

      return serialize(async () => {
        const existing = await store.find(intent.liker, intent.commentId);
        if (intent.action === 'unlike') {
          if (existing) await store.remove(existing.entityKey);
          return { liked: false, created: false };
        }
        if (existing) return { liked: true, created: false };
        await store.create({
          liker: intent.liker,
          commentId: intent.commentId,
          signature: request.signature,
          deadline: intent.deadline,
          likedAt: current,
        });
        return { liked: true, created: true };
      });
    },

    /** Who liked each of the comments: every comment asked about is present, with an empty list if unliked. */
    async likesFor(ids: unknown) {
      if (!Array.isArray(ids)) throw new CommentLikeError('invalid', 'ids must be a list');
      if (ids.length > MAX_COMMENTS_PER_READ) {
        throw new CommentLikeError(
          'invalid',
          `Ask about at most ${MAX_COMMENTS_PER_READ} comments`
        );
      }
      const unique = [...new Set(ids.map(toCommentId))];

      const likes: Record<string, Address[]> = {};
      let truncated = false;
      for (let i = 0; i < unique.length; i += READ_CONCURRENCY) {
        const chunk = unique.slice(i, i + READ_CONCURRENCY);
        const pages = await Promise.all(chunk.map((id) => store.likers(id)));
        pages.forEach((page, index) => {
          likes[chunk[index] as string] = page.entries.map((r) => r.liker);
          truncated ||= page.truncated;
        });
      }
      return { likes, truncated };
    },
  };
}
