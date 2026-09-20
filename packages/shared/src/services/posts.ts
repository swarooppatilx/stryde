import type { WalletClient } from 'viem';
import { getActiveConfig } from './client';
import { newPostIntent, postTypedData } from './postIntent';
import { socialCall } from './socialApi';

export { MAX_POST_LENGTH, MAX_POST_PHOTOS } from './postIntent';

export interface Post {
  /** The post's id; pass it to `deletePost`. */
  id: string;
  author: `0x${string}`;
  text: string;
  /** IPFS content ids of the photos, in order. */
  photos: string[];
  /** Unix seconds. */
  createdAt: number;
}

async function signAndSend<T>(
  wallet: WalletClient,
  fields: Omit<Parameters<typeof newPostIntent>[0], 'author'>
): Promise<T> {
  const account = wallet.account;
  if (!account) throw new Error('No wallet account found');
  const intent = newPostIntent({ author: account.address, ...fields });
  const signature = await wallet.signTypedData({
    account,
    ...postTypedData(intent, getActiveConfig().chain.id),
  });
  return socialCall<T>('post', { method: 'POST', body: JSON.stringify({ intent, signature }) });
}

/**
 * Publishes a post (text and/or photos already pinned to IPFS) after the wallet signs it. Pass the
 * same `clientId` when retrying: the server then returns the post it already stored.
 */
export async function createPost(
  wallet: WalletClient,
  post: { text: string; photos: string[]; clientId: string }
): Promise<Post> {
  const result = await signAndSend<{ post: Post }>(wallet, { action: 'create', ...post });
  return result.post;
}

/** Removes one of the author's own posts after the wallet signs the removal. */
export async function deletePost(wallet: WalletClient, postId: string): Promise<void> {
  await signAndSend<{ deleted: true }>(wallet, { action: 'delete', postId });
}

/** The newest posts by these authors, newest first. */
export async function getPosts(authors: readonly `0x${string}`[], limit: number): Promise<Post[]> {
  if (authors.length === 0) return [];
  const result = await socialCall<{ posts: Post[] }>(
    `posts?authors=${authors.join(',')}&limit=${limit}`
  );
  return result.posts;
}
