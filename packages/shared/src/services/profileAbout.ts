import type { WalletClient } from 'viem';
import { getActiveConfig } from './client';
import { aboutTypedData, newAboutIntent } from './profileAboutIntent';
import { socialCall } from './socialApi';

export { MAX_BIO_LENGTH, MAX_LOCATION_LENGTH } from './profileAboutIntent';

export interface About {
  bio: string;
  location: string;
}

/** Saves the athlete's bio and location after the wallet signs the exact text; empty text clears it. */
export async function setAbout(wallet: WalletClient, about: About): Promise<About> {
  const account = wallet.account;
  if (!account) throw new Error('No wallet account found');

  const intent = newAboutIntent({ author: account.address, ...about });
  const signature = await wallet.signTypedData({
    account,
    ...aboutTypedData(intent, getActiveConfig().chain.id),
  });
  const result = await socialCall<{ about: About }>('about', {
    method: 'POST',
    body: JSON.stringify({ intent, signature }),
  });
  return result.about;
}

/** Bio and location for the authors that have set them, keyed by lowercase wallet address. */
export async function getAbout(authors: readonly `0x${string}`[]): Promise<Record<string, About>> {
  if (authors.length === 0) return {};
  const result = await socialCall<{ about: Record<string, About> }>(
    `about?authors=${authors.join(',')}`
  );
  return result.about;
}
