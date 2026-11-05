import { services } from '@repo/shared';
import { orphanedPosts, type PostEntry } from '@/utils/postFeed';
import { MULTI_LINE_CONTROL_CHARACTERS } from '@/utils/textRules';
import {
  CREATE_POST,
  type CreatePostIntent,
  DELETE_POST,
  type DeletePostIntent,
} from './postIntents';

export interface PostActionDeps {
  author(): string;
  /** Epoch ms. */
  now(): number;
  newId(): string;
  addPending(post: Omit<PostEntry, 'pending'>): void;
  remove(id: string): void;
  enqueue(entry: { kind: string; key: string; payload: unknown }): Promise<void>;
}

export type PublishResult = { ok: true } | { ok: false; error: string };

const LOCAL_PREFIX = 'local:';

/**
 * Publishes a post, local first: it shows at once, marked pending, and the outbox pins the photos
 * and sends it whenever it can.
 */
export async function publishPost(
  deps: PostActionDeps,
  input: { text: string; photoUris: readonly string[] }
): Promise<PublishResult> {
  const text = input.text.trim();
  const photoUris = [...input.photoUris];
  if (!text && photoUris.length === 0)
    return { ok: false, error: 'Write something or add a photo' };
  if (text.length > services.posts.MAX_POST_LENGTH) {
    return {
      ok: false,
      error: `A post can be at most ${services.posts.MAX_POST_LENGTH} characters`,
    };
  }
  if (photoUris.length > services.posts.MAX_POST_PHOTOS) {
    return { ok: false, error: `A post can have at most ${services.posts.MAX_POST_PHOTOS} photos` };
  }
  if (MULTI_LINE_CONTROL_CHARACTERS.test(text)) {
    return { ok: false, error: 'Posts cannot contain control characters' };
  }

  const id = deps.newId();
  const localId = `${LOCAL_PREFIX}${id}`;
  deps.addPending({
    id: localId,
    author: deps.author(),
    text,
    photos: photoUris,
    createdAt: Math.floor(deps.now() / 1000),
  });
  const intent: CreatePostIntent = { localId, clientId: id, text, photoUris };
  await deps.enqueue({ kind: CREATE_POST, key: `post:${localId}`, payload: intent });
  return { ok: true };
}

/** Removes a published post at once and queues the removal. A post still being sent has nothing to remove yet. */
export async function removePost(deps: PostActionDeps, postId: string): Promise<void> {
  if (postId.startsWith(LOCAL_PREFIX)) return;
  deps.remove(postId);
  const intent: DeletePostIntent = { postId };
  await deps.enqueue({ kind: DELETE_POST, key: `post:delete:${postId}`, payload: intent });
}

/**
 * Sends again any post still marked as sending that has nothing queued (the queue was cleared, or
 * the post was written under an older build). The client id is the one in its local id, so the
 * server still publishes it only once.
 */
export async function requeueOrphans(
  deps: PostActionDeps,
  posts: readonly PostEntry[],
  entries: readonly { key?: string }[]
): Promise<void> {
  for (const post of orphanedPosts(posts, entries)) {
    const intent: CreatePostIntent = {
      localId: post.id,
      clientId: post.id.slice(LOCAL_PREFIX.length),
      text: post.text,
      photoUris: post.photos,
    };
    await deps.enqueue({ kind: CREATE_POST, key: `post:${post.id}`, payload: intent });
  }
}
