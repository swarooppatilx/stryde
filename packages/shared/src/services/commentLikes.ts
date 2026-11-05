import type { WalletClient } from 'viem';
import { getActiveConfig } from './client';
import { commentLikeTypedData, newCommentLikeIntent } from './commentLikeIntent';
import { socialCall } from './socialApi';

export interface CommentLikeResult {
  liked: boolean;
  created: boolean;
}

export interface CommentLikes {
  /** Who liked each comment (lower-case wallets); every comment asked about is present. */
  likes: Record<string, `0x${string}`[]>;
  /** More likes exist than one response carries. */
  truncated: boolean;
}

/** Likes or unlikes a comment after the wallet signs an intent the API can verify. */
export async function setCommentLike(
  wallet: WalletClient,
  commentId: `0x${string}`,
  like: boolean
): Promise<CommentLikeResult> {
  const account = wallet.account;
  if (!account) throw new Error('No wallet account found');

  const intent = newCommentLikeIntent({
    liker: account.address,
    commentId,
    action: like ? 'like' : 'unlike',
  });
  const signature = await wallet.signTypedData({
    account,
    ...commentLikeTypedData(intent, getActiveConfig().chain.id),
  });
  return socialCall<CommentLikeResult>('comment-like', {
    method: 'POST',
    body: JSON.stringify({ intent, signature }),
  });
}

/** Who liked each of these comments (up to 100 at a time). */
export const getCommentLikes = (commentIds: readonly `0x${string}`[]) =>
  socialCall<CommentLikes>(`comment-likes?ids=${commentIds.join(',')}`);
