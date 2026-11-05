import type { WalletClient } from 'viem';
import { getActiveConfig } from './client';
import { newPushIntent, type PushPlatform, pushTypedData } from './pushIntent';
import { apiCall } from './socialApi';

export interface PushRegistration {
  token: string;
  platform: PushPlatform;
}

export interface PushResult {
  registered: boolean;
  /** Absent on an unregister. */
  created?: boolean;
}

async function send(
  wallet: WalletClient,
  registration: PushRegistration,
  action: 'register' | 'unregister'
): Promise<PushResult> {
  const account = wallet.account;
  if (!account) throw new Error('No wallet account found');

  const intent = newPushIntent({ owner: account.address, ...registration, action });
  const signature = await wallet.signTypedData({
    account,
    ...pushTypedData(intent, getActiveConfig().chain.id),
  });
  return apiCall<PushResult>('push', action, {
    method: 'POST',
    body: JSON.stringify({ intent, signature }),
  });
}

/** Attaches this phone's push token to the wallet's account after the wallet signs an intent the API can verify. */
export const registerPushToken = (wallet: WalletClient, registration: PushRegistration) =>
  send(wallet, registration, 'register');

/** Detaches this phone, so a signed-out account stops receiving its notifications. */
export const unregisterPushToken = (wallet: WalletClient, registration: PushRegistration) =>
  send(wallet, registration, 'unregister');
