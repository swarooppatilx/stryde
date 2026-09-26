import { isHex } from 'viem';
import type { PostIntent } from './posts.js';

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
    domain: { name: 'Stryde Social', version: '1', chainId },
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

interface TypedDataVerifier {
  verifyTypedData(params: {
    address: `0x${string}`;
    signature: `0x${string}`;
    domain: ReturnType<typeof postTypedData>['domain'];
    types: typeof POST_TYPES;
    primaryType: 'Post';
    message: ReturnType<typeof postTypedData>['message'];
  }): Promise<boolean>;
}

/** Checks the author really signed this exact post. The chain client also accepts smart-wallet (ERC-1271) signatures. */
export function createPostVerifier(client: TypedDataVerifier, chainId: number) {
  return async (intent: PostIntent, signature: string): Promise<boolean> => {
    // Not even hex, so not a signature: say so. Anything else that fails (an RPC outage) must surface.
    if (!isHex(signature)) return false;
    return client.verifyTypedData({
      address: intent.author,
      signature,
      ...postTypedData(intent, chainId),
    });
  };
}
