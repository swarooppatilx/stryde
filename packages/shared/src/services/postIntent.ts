export const POST_INTENT_TTL_SECONDS = 120;

/** The API refuses more or longer (packages/api/src/lib/posts.ts); the app checks first. */
export const MAX_POST_LENGTH = 500;
export const MAX_POST_PHOTOS = 4;

export type PostAction = 'create' | 'delete';

export interface PostIntent {
  author: `0x${string}`;
  action: PostAction;
  /** Already trimmed: the API verifies the signature against exactly this text. */
  text: string;
  /** IPFS content ids of the photos, in order. */
  photos: string[];
  /** The post to delete; empty when creating. */
  postId: string;
  /**
   * Chosen once per post and kept across retries: the server returns the post it already stored for
   * this id instead of publishing it again. Empty when deleting.
   */
  clientId: string;
  /** Unix seconds; the server rejects the intent after this. */
  deadline: number;
}

const POST_TYPES = {
  Post: [
    { name: 'author', type: 'address' },
    { name: 'action', type: 'string' },
    { name: 'text', type: 'string' },
    { name: 'photos', type: 'string' },
    { name: 'postId', type: 'string' },
    { name: 'clientId', type: 'string' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function newPostIntent(
  fields: {
    author: `0x${string}`;
    action: PostAction;
    text?: string;
    photos?: string[];
    postId?: string;
    clientId?: string;
  },
  nowSeconds: number = Math.floor(Date.now() / 1000)
): PostIntent {
  return {
    author: fields.author,
    action: fields.action,
    text: (fields.text ?? '').trim(),
    photos: fields.photos ?? [],
    postId: fields.postId ?? '',
    clientId: fields.clientId ?? '',
    deadline: nowSeconds + POST_INTENT_TTL_SECONDS,
  };
}

/** What the wallet signs. The same shape is rebuilt by the API to check the signature. */
export function postTypedData(intent: PostIntent, chainId: number) {
  return {
    domain: { name: 'Stryde Social', version: '1', chainId },
    types: POST_TYPES,
    primaryType: 'Post' as const,
    message: {
      author: intent.author,
      action: intent.action,
      text: intent.text,
      // Content ids are plain letters and digits, so a comma cannot occur inside one.
      photos: intent.photos.join(','),
      postId: intent.postId,
      clientId: intent.clientId,
      deadline: BigInt(intent.deadline),
    },
  };
}
