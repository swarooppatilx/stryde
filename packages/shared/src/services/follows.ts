import type { WalletClient } from 'viem';
import { getActiveConfig } from './client';
import { followTypedData, newFollowIntent } from './followIntent';
import { socialCall } from './socialApi';

export interface FollowResult {
  following: boolean;
  created: boolean;
}

export interface FollowList {
  addresses: `0x${string}`[];
  /** Same wallets with when each follow happened (unix seconds, 0 if unknown). */
  entries: { address: `0x${string}`; followedAt: number }[];
  /** More follows exist than one response carries. */
  truncated: boolean;
}

const call = socialCall;

/** Follows or unfollows `followee` after the wallet signs an intent the API can verify. */
export async function setFollowing(
  wallet: WalletClient,
  followee: `0x${string}`,
  follow: boolean
): Promise<FollowResult> {
  const account = wallet.account;
  if (!account) throw new Error('No wallet account found');

  const intent = newFollowIntent({
    follower: account.address,
    followee,
    action: follow ? 'follow' : 'unfollow',
  });
  const signature = await wallet.signTypedData({
    account,
    ...followTypedData(intent, getActiveConfig().chain.id),
  });
  return call<FollowResult>('follow', {
    method: 'POST',
    body: JSON.stringify({ intent, signature }),
  });
}

export const getFollowing = (address: `0x${string}`) => call<FollowList>(`following/${address}`);
export const getFollowers = (address: `0x${string}`) => call<FollowList>(`followers/${address}`);
