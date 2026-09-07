import { Profile, type ProfileCreated } from '../../generated/ProfileRegistry/ProfileRegistry';

export function handleProfileCreated(event: ProfileCreated): void {
  const profile = new Profile(event.params.wallet);
  profile.username = event.params.username;
  profile.profileId = event.params.profileId;
  profile.createdAt = event.params.joinedAt;
  profile.save();
}
