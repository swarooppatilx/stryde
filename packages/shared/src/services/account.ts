import type { WalletClient } from 'viem';
import { accountDeleteTypedData, newAccountDeleteIntent } from './accountDeleteIntent';
import { getActiveConfig } from './client';
import { apiCall } from './socialApi';

/** How many records of each kind the server removed. */
export interface AccountDeleteCounts {
  follows: number;
  posts: number;
  about: number;
  commentLikes: number;
  reports: number;
  pushTokens: number;
  beacons: number;
}

export interface AccountDeleteResult {
  deleted: boolean;
  counts: AccountDeleteCounts;
}

/** Asks the server to remove what it wrote for this account, after the wallet signs an intent the API can verify. */
export async function deleteAccountData(wallet: WalletClient): Promise<AccountDeleteResult> {
  const account = wallet.account;
  if (!account) throw new Error('No wallet account found');

  const intent = newAccountDeleteIntent({ owner: account.address });
  const signature = await wallet.signTypedData({
    account,
    ...accountDeleteTypedData(intent, getActiveConfig().chain.id),
  });
  return apiCall<AccountDeleteResult>('account', 'delete', {
    method: 'POST',
    body: JSON.stringify({ intent, signature }),
  });
}
