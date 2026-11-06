import type { WalletClient } from 'viem';
import { type Handler, RejectedError } from '@/backends/outbox/outbox';
import { refuseApiError, refuseContractRevert } from '@/services/refusals';
import { revertName } from '@/utils/isContractRevert';

export const SET_USERNAME = 'setUsername';
export const SET_AVATAR = 'setAvatar';
export const SET_ABOUT = 'setAbout';
/** One waiting bio/location change at a time: a newer one replaces it. */
export const ABOUT_OUTBOX_KEY = 'profile:about';
export const SYNC_PRIVY_USERNAME = 'syncPrivyUsername';

export interface SetUsernameIntent {
  username: string;
  /** What to show again if the chain refuses the new name for good. */
  previous?: string;
}
export interface SetAboutIntent {
  bio: string;
  location: string;
  /** What to show again if the server refuses the new text for good. */
  previous?: { bio: string; location: string };
}
export interface SetAvatarIntent {
  /** The photo the athlete picked, on this device. */
  uri: string;
}
export interface SyncPrivyUsernameIntent {
  userId: string;
  username: string;
}

export interface ProfileIntentDeps {
  wallet(): WalletClient | null;
  /** False until this wallet has registered a profile; there is nothing to write before that. */
  hasOnchainProfile(): boolean;
  chain: {
    setUsername(wallet: WalletClient, username: string): Promise<{ confirmed: boolean }>;
    setAvatar(wallet: WalletClient, cid: string): Promise<{ confirmed: boolean }>;
    /** The name this wallet's profile has onchain right now, or null if it cannot be found. */
    usernameOnChain(address: `0x${string}`): Promise<string | null>;
  };
  /** Signs the text with the wallet and saves it through the social API; throws on a refusal or an outage. */
  saveAbout(
    wallet: WalletClient,
    about: { bio: string; location: string }
  ): Promise<{ bio: string; location: string }>;
  /** Pins the picked photo and gives its cid. Pinning the same bytes again gives the same cid. */
  uploadImage(uri: string): Promise<string>;
  /** Shows the published photo (and remembers its cid) in place of the local one. */
  applyAvatar(cid: string): void;
  updatePrivy(userId: string, patch: { username: string }): Promise<void>;
}

function needWallet(deps: ProfileIntentDeps): WalletClient {
  const wallet = deps.wallet();
  if (!wallet) throw new Error('No wallet yet');
  return wallet;
}

export interface ProfileHandlers {
  setUsername: Handler;
  setAvatar: Handler;
  setAbout: Handler;
  syncPrivyUsername: Handler;
}

/** How each profile change reaches the chain and the account service. Every one is safe to repeat. */
export function createProfileHandlers(deps: ProfileIntentDeps): ProfileHandlers {
  return {
    setUsername: async (payload) => {
      const { username } = payload as SetUsernameIntent;
      if (!deps.hasOnchainProfile()) return;
      const wallet = needWallet(deps);
      try {
        const result = await deps.chain.setUsername(wallet, username);
        if (!result.confirmed) throw new Error('The change did not confirm yet');
      } catch (error) {
        if (revertName(error) === 'UsernameTaken') {
          // Taken could be an earlier try of this same rename that already went through.
          const address = wallet.account?.address;
          const current = address ? await deps.chain.usernameOnChain(address) : null;
          if (current === username) return;
          throw new RejectedError('That username is taken');
        }
        refuseContractRevert(error, 'username');
      }
    },

    setAvatar: async (payload) => {
      const { uri } = payload as SetAvatarIntent;
      const cid = await deps.uploadImage(uri);
      deps.applyAvatar(cid);
      if (!deps.hasOnchainProfile()) return;
      const wallet = needWallet(deps);
      try {
        const result = await deps.chain.setAvatar(wallet, cid);
        if (!result.confirmed) throw new Error('The change did not confirm yet');
      } catch (error) {
        refuseContractRevert(error, 'photo');
      }
    },

    setAbout: async (payload) => {
      const { bio, location } = payload as SetAboutIntent;
      const wallet = needWallet(deps);
      try {
        await deps.saveAbout(wallet, { bio, location });
      } catch (error) {
        // A 4xx is the server saying no for good; anything else (network, 5xx) is worth another go.
        refuseApiError(error);
      }
    },

    syncPrivyUsername: async (payload) => {
      const { userId, username } = payload as SyncPrivyUsernameIntent;
      await deps.updatePrivy(userId, { username });
    },
  };
}
