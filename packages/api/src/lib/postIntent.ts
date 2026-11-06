import type { PostIntent } from './posts.js';
import { createIntentVerifier, socialDomain } from './signedIntent.js';

/** Must match packages/shared/src/services/postIntent.ts, which the app signs with. */
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

export function postTypedData(intent: PostIntent, chainId: number) {
  return {
    domain: socialDomain(chainId),
    types: POST_TYPES,
    primaryType: 'Post' as const,
    message: {
      author: intent.author,
      action: intent.action,
      text: intent.text,
      photos: intent.photos.join(','),
      postId: intent.postId,
      clientId: intent.clientId,
      deadline: BigInt(intent.deadline),
    },
  };
}

/** Checks the author really signed this exact intent (see `createIntentVerifier`). */
export const createPostVerifier = createIntentVerifier(
  postTypedData,
  (intent: PostIntent) => intent.author
);
