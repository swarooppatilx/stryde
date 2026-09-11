import {
  AvatarUpdated,
  ProfileCreated,
  ProfileVerified,
} from '../../generated/ProfileRegistry/ProfileRegistry';
import { Profile } from '../../generated/schema';

export function handleProfileCreated(event: ProfileCreated): void {
  const profile = new Profile(event.params.wallet);
  profile.username = event.params.username;
  profile.profileId = event.params.profileId;
  profile.createdAt = event.params.joinedAt;
  profile.isVerified = false;
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
