import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { Profile } from '../generated/schema';

export function getOrCreateProfile(address: Bytes): Profile {
  let profile = Profile.load(address);
  if (!profile) {
    profile = new Profile(address);
    profile.username = '';
    profile.profileId = BigInt.zero();
    profile.createdAt = BigInt.zero();
    profile.isVerified = false;
    profile.save();
  }
  return profile;
}
