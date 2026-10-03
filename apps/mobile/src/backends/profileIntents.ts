import { services } from '@repo/shared';
import { ipfsToHttpUrl, uploadImageToIpfs } from '@/services/ipfsService';
import {
  createProfileHandlers,
  SET_ABOUT,
  SET_AVATAR,
  SET_USERNAME,
  type SetAboutIntent,
  type SetUsernameIntent,
  SYNC_PRIVY_USERNAME,
} from '@/services/profileIntents';
import { updatePrivyMetadata } from '@/services/profileService';
import { getActiveWallet } from '@/services/wallet';
import { useProfileStore } from '@/stores/profileStore';
import { sameAddress } from '@/utils/address';
import { Toast } from '@/utils/toast';
import { registerOutboxHandler, registerRejectionHandler } from './outbox/appOutbox';

/** Teaches the outbox how profile changes (username, photo, account-service mirror) are delivered. */
export function registerProfileIntents(): void {
  const handlers = createProfileHandlers({
    wallet: getActiveWallet,
    hasOnchainProfile: () => Boolean(useProfileStore.getState().profileId),
    chain: {
      setUsername: (wallet, username) => services.profile.setUsername(wallet, username),
      setAvatar: (wallet, cid) => services.profile.setAvatar(wallet, cid),
      usernameOnChain: async (address) => {
        const users = await services.profile.getRegisteredUsers();
        return users.find((user) => sameAddress(user.wallet, address))?.username ?? null;
      },
    },
    saveAbout: (wallet, about) => services.profileAbout.setAbout(wallet, about),
    uploadImage: async (uri) => {
      const name = useProfileStore.getState().username || 'user';
      return (await uploadImageToIpfs(`avatar-${name}`, uri)).cid;
    },
    applyAvatar: (cid) => {
      const profile = useProfileStore.getState();
      profile.setAvatarCid(cid);
      profile.setAvatar(ipfsToHttpUrl(cid));
    },
    updatePrivy: async (userId, patch) => {
      // The service reports failure as `false` instead of throwing; throw so the outbox retries.
      if (!(await updatePrivyMetadata(userId, patch))) {
        throw new Error('The account service did not accept the update');
      }
    },
  });

  registerOutboxHandler(SET_USERNAME, handlers.setUsername);
  registerOutboxHandler(SET_AVATAR, handlers.setAvatar);
  registerOutboxHandler(SET_ABOUT, handlers.setAbout);
  registerOutboxHandler(SYNC_PRIVY_USERNAME, handlers.syncPrivyUsername);

  registerRejectionHandler(SET_USERNAME, (entry, reason) => {
    const { previous } = entry.payload as SetUsernameIntent;
    if (previous) useProfileStore.getState().setUsername(previous);
    Toast.fail(reason, 3);
  });
  registerRejectionHandler(SET_ABOUT, (entry, reason) => {
    const { previous } = entry.payload as SetAboutIntent;
    if (previous) useProfileStore.getState().setAbout(previous);
    Toast.fail(reason, 3);
  });
  registerRejectionHandler(SET_AVATAR, (_entry, reason) => {
    Toast.fail(reason, 3);
  });
}
