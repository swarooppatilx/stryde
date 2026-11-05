import {
  AvatarUpdated,
  ProfileCreated,
  ProfileRegistry,
  ProfileUpdated,
  ProfileVerified,
} from '../../generated/ProfileRegistry/ProfileRegistry';
import { getOrCreateProfile } from '../helpers';
import { Profile } from '../../generated/schema';

export function handleProfileCreated(event: ProfileCreated): void {
  // The wallet may already have a placeholder (it was named in an event before it registered);
  // fill that in rather than replacing it, so nothing recorded about it is lost.
  const profile = getOrCreateProfile(event.params.wallet);
  profile.username = event.params.username;
  profile.profileId = event.params.profileId;
  profile.createdAt = event.params.joinedAt;
  profile.save();
}

export function handleProfileUpdated(event: ProfileUpdated): void {
  // The event names the profile id, not the wallet, and the profile entity is keyed by wallet.
  const registry = ProfileRegistry.bind(event.address);
  const wallet = registry.try_getWallet(event.params.profileId);
  if (wallet.reverted) return;
  const profile = Profile.load(wallet.value);
  if (!profile) return;
  profile.username = event.params.username;
  profile.save();
}

export function handleAvatarUpdated(event: AvatarUpdated): void {
  const profile = Profile.load(event.params.wallet);
  if (!profile) return;
  profile.avatarCid = event.params.cid;
  profile.save();
}

export function handleProfileVerified(event: ProfileVerified): void {
  const profile = Profile.load(event.params.wallet);
  if (!profile) return;
  profile.isVerified = true;
  profile.verifiedAt = event.params.verifiedAt;
  profile.save();
}
