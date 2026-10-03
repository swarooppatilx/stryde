import { ipfsToHttpUrl } from '@/utils/ipfsUrl';

/** The avatar to draw: the pinned IPFS copy when there is one, else the stored URI. */
export function resolveAvatarUri(avatar: string | null, avatarCid: string | null): string | null {
  if (!avatar) return null;
  return avatarCid ? ipfsToHttpUrl(avatarCid) : avatar;
}
