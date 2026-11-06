import type { WalletClient } from 'viem';
import type { Handler } from '@/backends/outbox/outbox';
import { apiRefusal, refuseApiError } from '@/services/refusals';

export const CREATE_POST = 'createPost';
export const DELETE_POST = 'deletePost';

export interface CreatePostIntent {
  /** The id the post has on this device until the server gives it one. */
  localId: string;
  /** Chosen once when the post is written and kept on every retry, so the server never publishes it twice. */
  clientId: string;
  text: string;
  /** The photos picked, on this device; pinned when the post is sent. */
  photoUris: string[];
}
export interface DeletePostIntent {
  postId: string;
}

interface PublishedPost {
  id: string;
  author: `0x${string}`;
  text: string;
  photos: string[];
  createdAt: number;
}

export interface PostIntentDeps {
  wallet(): WalletClient | null;
  /** Pins the photo and gives its content id. Pinning the same bytes again gives the same id. */
  uploadImage(uri: string): Promise<string>;
  createPost(
    wallet: WalletClient,
    post: { text: string; photos: string[]; clientId: string }
  ): Promise<PublishedPost>;
  deletePost(wallet: WalletClient, postId: string): Promise<void>;
  /** Shows the published post in place of the one waiting on this device. */
  onPublished(localId: string, post: PublishedPost): void;
}

function needWallet(deps: PostIntentDeps): WalletClient {
  const wallet = deps.wallet();
  if (!wallet) throw new Error('No wallet yet');
  return wallet;
}

/**
 * A 4xx is the server saying no for good; anything else (network, 5xx) is worth another go. A 429
 * is also final here: the server uses it for the daily post limit, which a retry cannot lift.
 */
function refuseOrRetry(error: unknown): never {
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 429) throw apiRefusal(error);
  refuseApiError(error);
}

export interface PostHandlers {
  createPost: Handler;
  deletePost: Handler;
}

/** How a post reaches the server. A retry re-pins the same photos (same ids) and sends the same text. */
export function createPostHandlers(deps: PostIntentDeps): PostHandlers {
  return {
    createPost: async (payload) => {
      const { localId, clientId, text, photoUris } = payload as CreatePostIntent;
      const wallet = needWallet(deps);
      // Pinned one after another: photos are few, and a failure then names the one that failed.
      const photos: string[] = [];
      for (const uri of photoUris) photos.push(await deps.uploadImage(uri));
      try {
        const post = await deps.createPost(wallet, { text, photos, clientId });
        deps.onPublished(localId, post);
      } catch (error) {
        refuseOrRetry(error);
      }
    },

    deletePost: async (payload) => {
      const { postId } = payload as DeletePostIntent;
      const wallet = needWallet(deps);
      try {
        await deps.deletePost(wallet, postId);
      } catch (error) {
        refuseOrRetry(error);
      }
    },
  };
}
