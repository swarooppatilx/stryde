import { AvatarUpdated, ProfileCreated } from '../../generated/ProfileRegistry/ProfileRegistry';
import { Profile } from '../../generated/schema';

export function handleProfileCreated(event: ProfileCreated): void {
  const profile = new Profile(event.params.wallet);
  profile.username = event.params.username;
  profile.profileId = event.params.profileId;
  profile.createdAt = event.params.joinedAt;
  profile.save();
}

export function handleAvatarUpdated(event: AvatarUpdated): void {
  const profile = Profile.load(event.params.wallet);
  if (!profile) return;
  profile.avatarCid = event.params.cid;
  profile.save();
}
